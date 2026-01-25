const std = @import("std");
const c_allocator = std.heap.c_allocator;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const hooks = @import("module/native/hooks.zig");
const interface = @import("module/native/interface.zig");
const php = @import("php.zig");
const HashTable = php.HashTable;
const HashPosition = php.HashPosition;
const String = php.String;
const Value = php.Value;
const zig_class = @import("zig-class.zig");
const ZigClass = zig_class.ZigClass;
const fn_transform = @import("zigft/fn-transform.zig");

pub const ModuleHost = struct {
    ref_count: isize = 0,
    module: ?*Module = null,
    library: ?std.DynLib = null,
    redirection_mask: hooks.Syscall.Mask = .{},
    global_error_set: ?*HashTable = null,
    load_ctx: *LoadContext = undefined,

    pub const Syscall = hooks.Syscall;
    const Handle = *opaque {};
    const Module = interface.Module(Handle);
    const Jscall = Module.Jscall;
    const LoadContext = struct {
        value_list: std.ArrayList(Value),
        structure_map: HashTable,
        instance_list: HashTable,
        class_list: HashTable,
        key_memory: *String,
        key_slots: *String,
        counters: struct {
            @"struct": usize = 0,
            @"union": usize = 0,
            error_set: usize = 0,
            @"enum": usize = 0,
            @"opaque": usize = 0,
        } = .{},

        pub fn init() !*@This() {
            const self = try php.allocator.create(@This());
            errdefer php.allocator.destroy(self);
            self.* = .{
                .value_list = try .initCapacity(php.allocator, 64),
                .structure_map = php.createHashTable(null),
                .instance_list = php.createHashTable(null),
                .class_list = php.createHashTable(null),
                .key_memory = php.createInternedString("memory"),
                .key_slots = php.createInternedString("slots"),
            };
            return self;
        }

        pub fn deinit(self: *@This()) void {
            for (self.value_list.items) |*item| {
                if (php.getValuePointer(*ByteBuffer, item)) |b|
                    b.release()
                else |_|
                    php.release(item);
            }
            self.value_list.deinit(php.allocator);
            php.destroyHashTable(&self.structure_map);
            php.destroyHashTable(&self.instance_list);
            php.destroyHashTable(&self.class_list);
            php.allocator.destroy(self);
        }
    };

    pub fn load(path: []const u8) !*Value {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();
        const module = lib.lookup(*Module, "zig_module") orelse return error.MissingSymbol;
        if (module.version != Module.current_version) return error.IncorrectVersion;
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{
            .load_ctx = try LoadContext.init(),
            .module = module,
        };
        defer self.load_ctx.deinit();
        _ = module.exports.set_host_instance(@ptrCast(self));
        try self.exportFunctionsToModule();
        // retrieve and run factory thunk
        const thunk_address: usize = try self.getFactoryThunk();
        try self.runThunk(thunk_address, 0xDEADC0DE, 0xDEADC0DE);
        // the last class to get finalized is the root namespace
        var last: ?*Value = null;
        var pos: HashPosition = undefined;
        php.initializeHashPosition(&self.load_ctx.class_list, &pos);
        while (php.getHashPositionValue(&self.load_ctx.class_list, &pos)) |value| {
            // initially, the host holds references to ZigClass objects through the "class"
            // property in the info hash tables; prior to destroying these we'll flip the
            // relationship so that these objects own the host instead;
            ZigClass.activate(value);
            last = value;
            if (!php.moveHashPositionForward(&self.load_ctx.class_list, &pos)) break;
        }
        const root = last orelse return error.NoRoot;
        php.addRef(root);
        return root;
    }

    pub fn addRef(self: *@This()) void {
        self.ref_count += 1;
        // std.debug.print("reference host (ref = {d})\n", .{self.ref_count});
    }

    pub fn release(self: *@This()) void {
        self.ref_count -= 1;
        // std.debug.print("release host (ref = {d})\n", .{self.ref_count});
        if (self.ref_count == 0) {
            std.debug.print("freeing host\n", .{});
            if (self.library) |*lib| lib.close();
            php.allocator.destroy(self);
        }
    }

    fn exportFunctionsToModule(self: *@This()) !void {
        @setEvalBranchQuota(2000000);
        const module = self.module orelse return error.NoLoadedModule;
        inline for (std.meta.fields(Module.Imports)) |field| {
            const name_c = comptime camelize(field.name);
            const func = @field(@This(), name_c);
            const Args = std.meta.ArgsTuple(@TypeOf(func));
            const RT = @typeInfo(@TypeOf(func)).@"fn".return_type.?;
            const Payload = switch (@typeInfo(RT)) {
                .error_union => |eu| eu.payload,
                else => RT,
            };
            const extra = if (Payload == void or Payload == E) 0 else 1;
            const NewArgs = comptime define: {
                const fields = std.meta.fields(Args);
                var new_fields: [fields.len + extra]std.builtin.Type.StructField = undefined;
                var new_args_info = @typeInfo(Args);
                new_args_info.@"struct".fields = &new_fields;
                for (&new_fields, 0..) |*field_ptr, i| {
                    const Arg = switch (i) {
                        0 => *Module.Host,
                        else => if (extra == 1 and i == new_fields.len - 1) *Payload else fields[i].type,
                    };
                    field_ptr.* = .{
                        .name = std.fmt.comptimePrint("{d}", .{i}),
                        .type = Arg,
                        .default_value_ptr = null,
                        .is_comptime = false,
                        .alignment = @alignOf(Arg),
                    };
                }
                break :define @Type(new_args_info);
            };
            const ns = struct {
                fn call(new_args: NewArgs) E {
                    var args: Args = undefined;
                    inline for (&args, 0..) |*arg_ptr, i| arg_ptr.* = switch (i) {
                        0 => @ptrCast(@alignCast(new_args[i])),
                        else => new_args[i],
                    };
                    const retval = @call(.auto, func, args);
                    if (retval) |payload| {
                        if (Payload == E) return payload;
                        if (extra == 1) new_args[new_args.len - 1].* = payload;
                        return .SUCCESS;
                    } else |_| {
                        return .FAULT;
                    }
                }
            };
            const transformed_func = fn_transform.spreadArgs(ns.call, .c);
            const T1 = @TypeOf(transformed_func);
            const T2 = @typeInfo(@TypeOf(@field(module.imports, field.name))).pointer.child;
            if (T1 != T2) {
                @compileError("Function declaration mismatch: " ++ field.name ++ "\n\nExpected: " ++ @typeName(T2) ++ "\n  Actual: " ++ @typeName(T1) ++ "\n");
            }
            @field(module.imports, field.name) = transformed_func;
        }
    }

    fn allocateValue(self: *@This(), value: Value) Handle {
        const handle_value = for (self.load_ctx.value_list.items, 0..) |*item, i| {
            if (item.u1.type_info == value.u1.type_info and item.value.ptr == value.value.ptr)
                break i + 1;
        } else insert: {
            self.load_ctx.value_list.append(php.allocator, value) catch
                @panic("Unable to allocate value");
            break :insert self.load_ctx.value_list.items.len;
        };
        return @ptrFromInt(handle_value);
    }

    fn dereference(self: *@This(), handle: Handle) *Value {
        const handle_value = @intFromPtr(handle);
        return &self.load_ctx.value_list.items[handle_value - 1];
    }

    fn createBool(self: *@This(), initializer: bool) !Handle {
        const value = php.createValueBool(initializer);
        return self.allocateValue(value);
    }

    fn createInteger(self: *@This(), initializer: i32, unsigned: bool) !Handle {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u32, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateValue(value);
    }

    fn createBigInteger(self: *@This(), initializer: i64, unsigned: bool) !Handle {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u64, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateValue(value);
    }

    fn createString(self: *@This(), bytes: [*]const u8, len: usize) !Handle {
        const value = php.createValueStringContent(bytes[0..len]);
        return self.allocateValue(value);
    }

    fn createView(self: *@This(), bytes: ?[*]const u8, len: usize, copying: bool, _: usize) !Handle {
        var buffer: *ByteBuffer = undefined;
        if (bytes) |b| {
            const slice = b[0..len];
            if (copying) {
                buffer = try ByteBuffer.createCopy(slice, 1);
                buffer.protect();
            } else {
                buffer = try ByteBuffer.createExternal(@constCast(slice));
            }
        } else {
            buffer = try ByteBuffer.createExternal("");
        }
        const value = php.createValuePointer(buffer);
        return self.allocateValue(value);
    }

    fn createInstance(self: *@This(), structure: Handle, dv: Handle, prefilled_slots: ?Handle) !Handle {
        var value = try ZigClass.createInstance(
            self.dereference(structure),
            self.dereference(dv),
            if (prefilled_slots) |s| self.dereference(s) else null,
        );
        _ = php.appendHashEntry(&self.load_ctx.instance_list, &value);
        return self.allocateValue(value);
    }

    fn createTemplate(self: *@This(), dv: ?Handle, slots: ?Handle) !Handle {
        var value: Value = php.createValueArray(null);
        if (dv) |v| try php.setPropertyRef(
            &value,
            self.load_ctx.key_memory,
            self.dereference(v),
        );
        if (slots) |v| try php.setPropertyRef(
            &value,
            self.load_ctx.key_slots,
            self.dereference(v),
        );
        return self.allocateValue(value);
    }

    fn createList(self: *@This()) !Handle {
        const value = php.createValueArray(null);
        return self.allocateValue(value);
    }

    fn createObject(self: *@This()) !Handle {
        const value = php.createValueArray(null);
        return self.allocateValue(value);
    }

    fn appendList(self: *@This(), list: Handle, element: Handle) !void {
        try php.addElementRef(
            self.dereference(list),
            self.dereference(element),
        );
    }

    fn getProperty(self: *@This(), object: Handle, key_bytes: [*]const u8, key_len: usize) !Handle {
        const value = try php.getProperty(
            self.dereference(object),
            php.createInternedString(key_bytes[0..key_len]),
        );
        return self.allocateValue(value.*);
    }

    fn setProperty(self: *@This(), object: Handle, key_bytes: [*]const u8, key_len: usize, value: ?Handle) !void {
        const key = php.createInternedString(key_bytes[0..key_len]);
        if (value) |v|
            try php.setPropertyRef(
                self.dereference(object),
                key,
                self.dereference(v),
            )
        else
            try php.deleteProperty(
                self.dereference(object),
                key,
            );
    }

    fn getSlotValue(self: *@This(), object: Handle, slot: usize) !Handle {
        const value = try php.getProperty(
            self.dereference(object),
            slot,
        );
        return self.allocateValue(value.*);
    }

    fn setSlotValue(self: *@This(), object: Handle, slot: usize, value: ?Handle) !void {
        if (value) |v|
            try php.setPropertyRef(
                self.dereference(object),
                slot,
                self.dereference(v),
            )
        else
            try php.deleteProperty(
                self.dereference(object),
                slot,
            );
    }

    fn getStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize) !Handle {
        const key = key_bytes[0..key_len];
        const structure = try php.getHashEntry(&self.load_ctx.structure_map, key);
        if (structure.u1.type_info == 0xaaaaaaaa) @panic("WTF??????");
        return self.allocateValue(structure.*);
    }

    fn setStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize, value: ?Handle) !void {
        const key = key_bytes[0..key_len];
        if (value) |v|
            try php.setHashEntryRef(
                &self.load_ctx.structure_map,
                key,
                self.dereference(v),
            )
        else
            try php.deleteHashEntry(&self.load_ctx.structure_map, key);
    }

    fn beginStructure(self: *@This(), structure: Handle) !void {
        try ZigClass.define(
            self,
            self.dereference(structure),
        );
    }

    fn finishStructure(self: *@This(), structure: Handle) !void {
        const class = try ZigClass.finalize(
            self.dereference(structure),
        );
        _ = php.appendHashEntry(&self.load_ctx.class_list, class);
    }

    fn enableCallback(self: *@This(), structure: Handle, template: Handle, member_flags: Handle) !void {
        _ = self;
        _ = structure;
        _ = template;
        _ = member_flags;
    }

    fn handleJscall(self: *@This(), call: *Jscall) !E {
        _ = self;
        _ = call;
        unreachable;
    }

    fn handleSyscall(self: *@This(), call: *Syscall) !E {
        _ = self;
        _ = call;
        unreachable;
    }

    fn getSyscallMask(self: *@This(), ptr: *hooks.Syscall.Mask) !void {
        var mask = self.redirection_mask;
        // a stat request can be handled by a 'stat' or an 'open' event handler
        if (mask.open) mask.stat = true;
        ptr.* = mask;
    }

    fn releaseFunction(self: *@This(), fn_id: usize) !void {
        _ = self;
        _ = fn_id;
    }

    fn redirectSyscalls(self: *@This(), ptr: *const anyopaque) !void {
        _ = self;
        _ = ptr;
    }

    fn enableMultithread(self: *@This()) !void {
        _ = self;
    }

    fn disableMultithread(self: *@This()) !void {
        _ = self;
    }

    pub fn initializeThread(self: *@This()) !void {
        _ = self;
    }

    pub fn deinitializeThread(self: *@This()) !void {
        _ = self;
    }

    fn getFactoryThunk(self: *@This()) !usize {
        var thunk_address: usize = 0;
        if (self.module.?.exports.get_factory_thunk(&thunk_address) != .SUCCESS)
            return error.UnableToFindFactoryFunction;
        return thunk_address;
    }

    pub fn runThunk(self: *@This(), thunk_address: usize, fn_address: usize, arg_address: usize) !void {
        if (self.module.?.exports.run_thunk(thunk_address, fn_address, arg_address) != .SUCCESS)
            return error.UnableToExecuteZigFunction;
    }
};

inline fn camelize(comptime name: []const u8) [:0]const u8 {
    var buffer: [name.len + 1]u8 = undefined;
    var len: usize = 0;
    var capitalize = false;
    for (name) |c| {
        if (c == '_') {
            capitalize = true;
        } else if (capitalize) {
            buffer[len] = std.ascii.toUpper(c);
            len += 1;
            capitalize = false;
        } else {
            buffer[len] = c;
            len += 1;
        }
    }
    buffer[len] = 0;
    return @ptrCast(buffer[0..len]);
}
