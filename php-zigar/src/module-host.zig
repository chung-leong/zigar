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
const Value = php.Value;
const zig_class = @import("zig-class.zig");
const ZigClass = zig_class.ZigClass;
const fn_transform = @import("zigft/fn-transform.zig");

pub const ModuleHost = struct {
    ref_count: isize = 1,
    module: ?*Module = null,
    library: ?std.DynLib = null,
    base_address: usize = 0,
    structure_map: HashTable = undefined,
    value_list: HashTable = undefined,
    redirection_mask: hooks.Syscall.Mask = .{},
    last_structure: ?*Value = null,

    const Module = interface.Module(*Value);
    const Jscall = Module.Jscall;
    pub const Syscall = hooks.Syscall;

    pub fn load(path: []const u8) !*Value {
        var self: *@This() = try php.allocator.create(@This());
        self.* = .{};
        errdefer php.allocator.destroy(self);
        var lib = try std.DynLib.open(path);
        errdefer lib.close();
        const module = lib.lookup(*Module, "zig_module") orelse return error.MissingSymbol;
        if (module.version != Module.current_version) return error.IncorrectVersion;
        self.module = module;
        self.base_address = get: {
            switch (builtin.target.os.tag) {
                .windows => {
                    const MBI = std.os.windows.MEMORY_BASIC_INFORMATION;
                    var mbi: MBI = undefined;
                    _ = try std.os.windows.VirtualQuery(module, &mbi, @sizeOf(MBI));
                    break :get @intFromPtr(mbi.AllocationBase);
                },
                else => {
                    const c = @cImport({
                        @cDefine("_GNU_SOURCE", {});
                        @cDefine("_BSD_SOURCE", {});
                        @cInclude("dlfcn.h");
                    });
                    var dl_info: c.Dl_info = undefined;
                    if (c.dladdr(module, &dl_info) == 0) return error.Unexpected;
                    break :get @intFromPtr(dl_info.dli_fbase.?);
                },
            }
        };
        self.structure_map = php.createHashTable(php.destructor.value);
        defer php.destroyHashTable(&self.structure_map);
        self.value_list = php.createHashTable(php.destructor.value);
        defer {
            // pointer objects aren't released automatically, so we have to do it manually
            var pos: HashPosition = undefined;
            php.initializeHashPosition(&self.value_list, &pos);
            while (php.getHashPositionValue(&self.value_list, &pos)) |value| {
                // if (php.getValueString(value)) |str| {
                //     std.debug.print("str => {x}, {d}\n", .{ @intFromPtr(str), str.*.gc.refcount });
                // } else |_| {}
                if (php.getValuePointer(*ByteBuffer, value)) |b| b.release() else |_| {}
                if (!php.moveHashPositionForward(&self.value_list, &pos)) break;
            }
            php.destroyHashTable(&self.value_list);
        }
        _ = module.exports.set_host_instance(@ptrCast(self));
        try self.exportFunctionsToModule();
        defer self.release();
        // retrieve and run factory thunk
        const thunk_address: usize = try self.getFactoryThunk();
        try self.runThunk(thunk_address, 0xDEADC0DE, 0xDEADC0DE);
        // the last structure to get finalized is the root namespace
        const root = self.last_structure orelse return error.NoRoot;
        const class = try php.getProperty(root, "class");
        php.addRef(class);
        return class;
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

    fn allocateValue(self: *@This(), value: Value) *Value {
        return php.appendHashEntry(&self.value_list, @constCast(&value));
    }

    fn createBool(self: *@This(), initializer: bool) !*Value {
        const value = php.createValueBool(initializer);
        return self.allocateValue(value);
    }

    fn createInteger(self: *@This(), initializer: i32, unsigned: bool) !*Value {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u32, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateValue(value);
    }

    fn createBigInteger(self: *@This(), initializer: i64, unsigned: bool) !*Value {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u64, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateValue(value);
    }

    fn createString(self: *@This(), bytes: [*]const u8, len: usize) !*Value {
        const value = php.createValueString(bytes[0..len]);
        return self.allocateValue(value);
    }

    fn createView(self: *@This(), bytes: ?[*]const u8, len: usize, copying: bool, _: usize) !*Value {
        var buffer: *ByteBuffer = undefined;
        if (bytes) |b| {
            const slice = b[0..len];
            if (copying)
                buffer = try ByteBuffer.createCopy(slice, 1)
            else
                buffer = try ByteBuffer.createExternal(@constCast(slice));
        } else {
            buffer = try ByteBuffer.createExternal("");
        }
        const value = php.createValuePointer(buffer);
        return self.allocateValue(value);
    }

    fn createInstance(self: *@This(), structure: *Value, dv: *Value, slots: ?*Value) !*Value {
        const value = try ZigClass.createInstance(structure, dv, slots);
        return self.allocateValue(value);
    }

    fn createTemplate(self: *@This(), dv: ?*Value, slots: ?*Value) !*Value {
        var value: Value = undefined;
        value = php.createValueArray();
        if (dv) |v| {
            const key = php.createInternedString("memory");
            try php.setPropertyRef(&value, key, v);
        }
        if (slots) |v| {
            const key = php.createInternedString("slots");
            try php.setPropertyRef(&value, key, v);
        }
        return self.allocateValue(value);
    }

    fn createList(self: *@This()) !*Value {
        const value = php.createValueArray();
        return self.allocateValue(value);
    }

    fn createObject(self: *@This()) !*Value {
        const value = php.createValueArray();
        return self.allocateValue(value);
    }

    fn appendList(_: *@This(), list: *Value, element: *Value) !void {
        try php.addElementRef(list, element);
    }

    fn getProperty(_: *@This(), object: *Value, key_bytes: [*]const u8, key_len: usize) !*Value {
        const key = php.createInternedString(key_bytes[0..key_len]);
        return try php.getProperty(object, key);
    }

    fn setProperty(_: *@This(), object: *Value, key_bytes: [*]const u8, key_len: usize, value: ?*Value) !void {
        const key = php.createInternedString(key_bytes[0..key_len]);
        if (value) |v|
            try php.setPropertyRef(object, key, v)
        else
            try php.deleteProperty(object, key);
    }

    fn getSlotValue(_: *@This(), object: *Value, slot: usize) !*Value {
        return try php.getProperty(object, slot);
    }

    fn setSlotValue(_: *@This(), object: *Value, slot: usize, value: ?*Value) !void {
        if (value) |v|
            try php.setPropertyRef(object, slot, v)
        else
            try php.deleteProperty(object, slot);
    }

    fn getStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize) !*Value {
        const key = key_bytes[0..key_len];
        return try php.getHashEntry(&self.structure_map, key);
    }

    fn setStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize, value: ?*Value) !void {
        const key = key_bytes[0..key_len];
        if (value) |v|
            try php.setHashEntryRef(&self.structure_map, key, v)
        else
            try php.deleteHashEntry(&self.structure_map, key);
    }

    fn beginStructure(self: *@This(), structure: *Value) !void {
        try ZigClass.define(self, structure);
    }

    fn finishStructure(self: *@This(), structure: *Value) !void {
        try ZigClass.finalize(structure);
        self.last_structure = structure;
    }

    fn enableCallback(self: *@This(), structure: *Value, template: *Value, member_flags: *Value) !void {
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
