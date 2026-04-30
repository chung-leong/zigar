const std = @import("std");
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const BufferMap = @import("buffer.zig").BufferMap;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const GarbageCollectionBuffer = @import("gc.zig").GarbageCollectionBuffer;
const ModuleGeneric = @import("module/native/interface.zig").Module;
const ObjectMap = @import("object.zig").ObjectMap;
const php = @import("php.zig");
const Array = php.Array;
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const StructureImporter = @import("import.zig").StructureImporter;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const fn_transform = @import("zigft/fn-transform.zig");

pub const ModuleHost = struct {
    ref_count: isize = 0,
    module: ?*Module = null,
    library: ?std.DynLib = null,
    global_error_set: ?*Array = null,
    importer: *StructureImporter = undefined,
    dispatcher: *CallDispatcher = undefined,
    allocator: std.mem.Allocator = undefined,
    unclaimed_buffer_map: BufferMap = .{},
    object_map: ObjectMap = .{},
    gc_buffer: GarbageCollectionBuffer = .empty,
    plain_object_table: HashTable,

    const Module = ModuleGeneric(StructureImporter.Handle);

    pub fn load(path: []const u8) !Value {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();
        const module = lib.lookup(*Module, "zig_module") orelse return error.MissingSymbol;
        if (module.version != Module.current_version) return error.IncorrectVersion;
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{
            .module = module,
            .plain_object_table = php.createHashTable(null),
        };
        self.allocator = .{ .ptr = self, .vtable = &BufferAllocator.vtable };
        // install hooks
        self.dispatcher = try .init(self);
        errdefer self.dispatcher.deinit();
        try self.dispatcher.installHooks(&lib, path, module.attributes.io_redirection);
        _ = module.exports.set_host_instance(@ptrCast(self));
        self.importer = try .init(self);
        defer self.importer.deinit();
        try self.exportFunctionsToModule();
        // retrieve and run factory thunk
        const thunk_address: usize = try self.getFactoryThunk();
        try self.runThunk(thunk_address, 0xDEADC0DE, 0xDEADC0DE);
        // activate acquired structures and get the root
        const root_class_obj = try self.importer.activateStructures();
        errdefer php.release(root_class_obj);
        return php.createValueObject(root_class_obj);
    }

    pub fn addRef(self: *@This()) void {
        self.ref_count += 1;
    }

    pub fn release(self: *@This()) void {
        self.ref_count -= 1;
        if (self.ref_count == 0) {
            // std.debug.print("freeing host\n", .{});
            self.unclaimed_buffer_map.deinit();
            self.object_map.deinit();
            self.dispatcher.deinit();
            self.gc_buffer.deinit();
            if (self.library) |*lib| lib.close();
            php.allocator.destroy(self);
        }
    }

    fn exportFunctionsToModule(self: *@This()) !void {
        @setEvalBranchQuota(2000000);
        const module = self.module orelse return error.NoLoadedModule;
        inline for (std.meta.fields(Module.Imports)) |field| {
            const name_c = comptime camelize(field.name);
            const Component = inline for (.{ StructureImporter, CallDispatcher }) |T| {
                if (@hasDecl(T, name_c)) break T;
            } else @compileError("Not implemented by any component: " ++ name_c);
            const func = @field(Component, name_c);
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
                        0 => select: {
                            // set self pointer to the matching component
                            const host: *ModuleHost = @ptrCast(@alignCast(new_args[0]));
                            break :select switch (Component) {
                                StructureImporter => host.importer,
                                CallDispatcher => host.dispatcher,
                                else => unreachable,
                            };
                        },
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

    pub fn runVariadicThunk(self: *@This(), thunk_address: usize, fn_address: usize, arg_address: usize, attr_address: usize, arg_count: usize) !void {
        if (self.module.?.exports.run_variadic_thunk(thunk_address, fn_address, arg_address, attr_address, arg_count) != .SUCCESS)
            return error.UnableToExecuteZigFunction;
    }

    const PlainObject = struct {
        value: Value,
        hash_table: *HashTable,
        status: enum { new, existing },
        is_tuple: bool,

        pub fn add(self: *@This(), name: *String, value: *const Value) void {
            if (self.is_tuple) {
                _ = php.appendHashEntryRef(self.hash_table, value);
            } else {
                php.setHashEntryRef(self.hash_table, name, value);
            }
        }
    };

    pub fn getPlainObject(self: *@This(), obj: *Object, is_tuple: bool) PlainObject {
        const key: i32 = @bitCast(obj.handle);
        if (php.getHashEntry(&self.plain_object_table, key) catch null) |existing| {
            php.addRef(existing);
            return .{
                .value = existing.*,
                .hash_table = php.getValueHashTable(existing) catch unreachable,
                .status = .existing,
                .is_tuple = is_tuple,
            };
        } else {
            const value = switch (is_tuple) {
                true => php.createValueArray(null),
                false => php.createValueObject(null),
            };
            // var value = php.createValueArray(null);
            // if (!is_tuple) php.convertValue(&value, .object) catch unreachable;
            php.setHashEntry(&self.plain_object_table, key, &value);
            return .{
                .value = value,
                .hash_table = php.getValueHashTable(&value) catch unreachable,
                .status = .new,
                .is_tuple = is_tuple,
            };
        }
    }

    pub fn removePlainObject(self: *@This(), obj: *Object) void {
        const key: i32 = @bitCast(obj.handle);
        _ = php.removeHashEntry(&self.plain_object_table, key);
    }
};

const BufferAllocator = struct {
    pub const vtable: std.mem.Allocator.VTable = .{
        .alloc = alloc,
        .resize = resize,
        .remap = remap,
        .free = free,
    };

    fn alloc(
        ctx: *anyopaque,
        len: usize,
        alignment: std.mem.Alignment,
        return_address: usize,
    ) ?[*]u8 {
        _ = return_address;
        const host: *ModuleHost = @ptrCast(@alignCast(ctx));
        const buf = host.unclaimed_buffer_map.add(len, alignment) catch return null;
        return buf.bytes.ptr;
    }

    fn resize(
        _: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        new_len: usize,
        return_address: usize,
    ) bool {
        _ = alignment;
        _ = return_address;
        return new_len <= memory.len;
    }

    fn remap(
        ctx: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        new_len: usize,
        return_address: usize,
    ) ?[*]u8 {
        if (resize(ctx, memory, alignment, new_len, return_address)) {
            return memory.ptr;
        }
        return null;
    }

    fn free(
        ctx: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        return_address: usize,
    ) void {
        _ = alignment;
        _ = return_address;
        const host: *ModuleHost = @ptrCast(@alignCast(ctx));
        // try releasing buffer that has just been allocated
        if (!host.unclaimed_buffer_map.free(memory)) {
            // failing that, look for a buffer that's being used by an object
            host.object_map.freeBuffer(memory);
        }
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
