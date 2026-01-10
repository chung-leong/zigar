const std = @import("std");
const c_allocator = std.heap.c_allocator;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const hooks = @import("module/native/hooks.zig");
const interface = @import("module/native/interface.zig");
const php = @import("php.zig");
const zig_class = @import("zig-class.zig");
const ZigClass = zig_class.ZigClass;
const fn_transform = @import("zigft/fn-transform.zig");

pub const ModuleHost = struct {
    ref_count: isize = 1,
    module: ?*Module = null,
    library: ?std.DynLib = null,
    base_address: usize = 0,
    structure_map: php.HashTable = undefined,
    value_list: php.HashTable = undefined,
    redirection_mask: hooks.Syscall.Mask = .{},
    last_structure: ?Value = null,

    const Module = interface.Module(Value);
    const Jscall = Module.Jscall;
    pub const Syscall = hooks.Syscall;
    const Value = *php.Value;

    pub fn load(path: []const u8) !Value {
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
        self.structure_map = php.createHashTable(.value);
        defer php.destroyHashTable(&self.structure_map);
        self.value_list = php.createHashTable(.value);
        defer php.destroyHashTable(&self.value_list);
        _ = module.exports.set_host_instance(@ptrCast(self));
        try self.exportFunctionsToModule();
        //
        defer self.release();
        // retrieve and run factory thunk
        var thunk_address: usize = 0;
        _ = module.exports.get_factory_thunk(&thunk_address);
        _ = module.exports.run_thunk(thunk_address, thunk_address, 0xaaaa_aaaa);
        const root = self.last_structure orelse return error.NoRoot;
        const class = try php.getProperty(root, "class");
        php.addValueRef(class);
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

    fn allocateValue(self: *@This(), value: php.Value) Value {
        return php.appendHashTableEntry(&self.value_list, @constCast(&value));
    }

    fn createBool(self: *@This(), initializer: bool) !Value {
        const value = php.createValueBool(initializer);
        return self.allocateValue(value);
    }

    fn createInteger(self: *@This(), initializer: i32, unsigned: bool) !Value {
        var value: php.Value = undefined;
        switch (@bitSizeOf(c_long)) {
            64 => {
                const long: c_long = if (unsigned) @as(u32, @bitCast(initializer)) else initializer;
                value = php.createValueLong(long);
            },
            32 => {
                if (unsigned and initializer < 0) {
                    const unsigned_value: u32 = @bitCast(initializer);
                    value = php.createValueDouble(@floatFromInt(unsigned_value));
                } else {
                    value = php.createValueLong(initializer);
                }
            },
            else => unreachable,
        }
        return self.allocateValue(value);
    }

    fn createBigInteger(self: *@This(), initializer: i64, unsigned: bool) !Value {
        var value: php.Value = undefined;
        switch (@bitSizeOf(c_long)) {
            64 => {
                if (unsigned and initializer < 0) {
                    const ulong: c_ulong = @bitCast(initializer);
                    value = php.createValueDouble(@floatFromInt(ulong));
                } else {
                    value = php.createValueLong(initializer);
                }
            },
            32 => {
                if (unsigned and initializer < 0) {
                    const unsigned_value: u64 = @bitCast(initializer);
                    value = php.createValueDouble(@floatFromInt(unsigned_value));
                } else {
                    if (std.math.minInt(c_long) <= initializer and initializer <= std.maxInt(c_long)) {
                        value = php.createValueLong(@truncate(initializer));
                    } else {
                        value = php.createValueDouble(@floatFromInt(initializer));
                    }
                }
            },
            else => unreachable,
        }
        return self.allocateValue(value);
    }

    fn createString(self: *@This(), bytes: [*]const u8, len: usize) !Value {
        const value = php.createValueString(bytes[0..len]);
        return self.allocateValue(value);
    }

    fn createView(self: *@This(), bytes: ?[*]const u8, len: usize, copying: bool, _: usize) !Value {
        var value: php.Value = undefined;
        if (bytes) |b| {
            const slice = b[0..len];
            if (copying) {
                value = php.createValueString(slice);
            } else {
                value = php.createValuePersistentString(slice);
            }
        } else {
            value = php.createValueString("");
        }
        return self.allocateValue(value);
    }

    fn createInstance(self: *@This(), structure: Value, dv: Value, slots: ?Value) !Value {
        _ = structure;
        _ = dv;
        _ = slots;
        const value = php.createValueNull();
        return self.allocateValue(value);
    }

    fn createTemplate(self: *@This(), dv: ?Value, slots: ?Value) !Value {
        var value: php.Value = undefined;
        value = php.createValueArray();
        if (dv) |v| {
            const key = php.createInternedString("MEMORY");
            try php.setPropertyRef(&value, key, v);
        }
        if (slots) |v| {
            const key = php.createInternedString("SLOTS");
            try php.setPropertyRef(&value, key, v);
        }
        return self.allocateValue(value);
    }

    fn createList(self: *@This()) !Value {
        const value = php.createValueArray();
        return self.allocateValue(value);
    }

    fn createObject(self: *@This()) !Value {
        const value = php.createValueArray();
        return self.allocateValue(value);
    }

    fn appendList(_: *@This(), list: Value, element: Value) !void {
        try php.addElementRef(list, element);
    }

    fn getProperty(_: *@This(), object: Value, key_bytes: [*]const u8, key_len: usize) !Value {
        const key = php.createInternedString(key_bytes[0..key_len]);
        return php.getProperty(object, key);
    }

    fn setProperty(_: *@This(), object: Value, key_bytes: [*]const u8, key_len: usize, value: ?Value) !void {
        const key = php.createInternedString(key_bytes[0..key_len]);
        if (value) |v|
            try php.setPropertyRef(object, key, v)
        else
            try php.deleteProperty(object, key);
    }

    fn getSlotValue(_: *@This(), object: Value, slot: usize) !Value {
        return try php.getProperty(object, slot);
    }

    fn setSlotValue(_: *@This(), object: Value, slot: usize, value: ?Value) !void {
        if (value) |v|
            try php.setPropertyRef(object, slot, v)
        else
            try php.deleteProperty(object, slot);
    }

    fn getStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize) !Value {
        const key = key_bytes[0..key_len];
        return try php.getHashTableEntry(&self.structure_map, key);
    }

    fn setStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize, value: ?Value) !void {
        const key = key_bytes[0..key_len];
        if (value) |v|
            try php.setHashTableEntryRef(&self.structure_map, key, v)
        else
            try php.deleteHashTableEntry(&self.structure_map, key);
    }

    fn beginStructure(self: *@This(), structure: Value) !void {
        try ZigClass.define(self, structure);
    }

    fn finishStructure(self: *@This(), structure: Value) !void {
        try ZigClass.finalize(structure);
        self.last_structure = structure;
    }

    fn enableCallback(self: *@This(), structure: Value, template: Value, member_flags: Value) !void {
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
