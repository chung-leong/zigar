const std = @import("std");
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const AbortSignal = @import("abort-signal.zig").AbortSignal;
const BufferMap = @import("buffer.zig").BufferMap;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const DynLib = @import("dyn-lib.zig").DynLib;
const GarbageCollectionBuffer = @import("gc.zig").GarbageCollectionBuffer;
const js_compat = @import("js-compat.zig");
const ArgStruct = @import("module/arg-struct.zig").ArgStruct;
const ModuleGeneric = @import("module/native/interface.zig").Module;
const ObjectMap = @import("object.zig").ObjectMap;
const php = @import("php.zig");
const Array = php.Array;
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const Long = php.Long;
const N = php.getStaticString;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const StructureImporter = @import("import.zig").StructureImporter;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigException = @import("exception.zig").ZigException;
const fn_transform = @import("zigft/fn-transform.zig");

pub const ModuleHost = struct {
    ref_count: isize = 0,
    cache_mask: usize,
    module: *Module,
    module_path: *String,
    library: ?DynLib = null,
    importer: *StructureImporter = undefined,
    dispatcher: *CallDispatcher = undefined,
    allocator_vtable: ?std.mem.Allocator.VTable = null,
    allocator_controllers: [std.meta.fields(AllocatorMethodId).len]usize = undefined,
    unclaimed_buffer_map: BufferMap = .{},
    object_map: ObjectMap = .{},
    gc_buffer: GarbageCollectionBuffer = .empty,
    plain_object_table: HashTable,
    exception_table: HashTable,

    const Module = ModuleGeneric(StructureImporter.Handle);
    const AllocatorMethodId = enum(usize) { alloc = 1, resize, remap, free };

    threadlocal var prev_cache_mask: usize = 0;

    pub fn setup() !void {
        try ZigClassEntry.registerRootClass();
        errdefer ZigClassEntry.unregisterRootClass();
        try ZigException.registerClass();
        errdefer ZigException.unregisterClass();
        try AbortSignal.registerClass();
        errdefer AbortSignal.unregisterClass();
        try js_compat.registerClasses();
        errdefer js_compat.registerClasses();
    }

    pub fn shutdown() void {
        ZigClassEntry.unregisterRootClass();
        ZigException.unregisterClass();
        AbortSignal.unregisterClass();
        js_compat.unregisterClasses();
        CallDispatcher.uninstallHandlers();
    }

    pub fn load(path: []const u8) !Value {
        var lib: DynLib = try DynLib.open(path);
        errdefer lib.close();
        const module = lib.lookup(*Module, "zig_module") orelse return error.MissingSymbol;
        if (module.version != Module.current_version) return error.IncorrectVersion;
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        const cache_mask = std.hash.CityHash64.hash(std.mem.asBytes(&prev_cache_mask));
        self.* = .{
            .cache_mask = cache_mask,
            .module = module,
            .module_path = php.createString(std.mem.sliceTo(module.module_path, 0)),
            .plain_object_table = php.createHashTable(null),
            .exception_table = php.createHashTable(php.getDestructor(.value)),
        };
        prev_cache_mask = cache_mask;
        // install hooks
        self.dispatcher = try .init(self);
        errdefer self.dispatcher.deinit();
        try self.dispatcher.installHooks(&lib, module.attributes.io_redirection);
        _ = module.exports.set_host_instance(@ptrCast(self));
        _ = module.exports.set_language_name("PHP");
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
            php.destroyHashTable(&self.plain_object_table);
            php.destroyHashTable(&self.exception_table);
            php.release(self.module_path);
            self.freeAllocatorVTable();
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
            const T2 = @typeInfo(@TypeOf(@field(self.module.imports, field.name))).pointer.child;
            if (T1 != T2) {
                @compileError("Function declaration mismatch: " ++ field.name ++ "\n\nExpected: " ++ @typeName(T2) ++ "\n  Actual: " ++ @typeName(T1) ++ "\n");
            }
            @field(self.module.imports, field.name) = transformed_func;
        }
    }

    fn getFactoryThunk(self: *@This()) !usize {
        var thunk_address: usize = 0;
        if (self.module.exports.get_factory_thunk(&thunk_address) != .SUCCESS)
            return error.UnableToFindFactoryFunction;
        return thunk_address;
    }

    pub fn runThunk(self: *@This(), thunk_address: usize, fn_address: usize, arg_address: usize) !void {
        if (self.module.exports.run_thunk(thunk_address, fn_address, arg_address) != .SUCCESS)
            return error.UnableToExecuteZigFunction;
    }

    pub fn runVariadicThunk(self: *@This(), thunk_address: usize, fn_address: usize, arg_address: usize, attr_address: usize, arg_count: usize) !void {
        if (self.module.exports.run_variadic_thunk(thunk_address, fn_address, arg_address, attr_address, arg_count) != .SUCCESS)
            return error.UnableToExecuteZigFunction;
    }

    const PlainObject = struct {
        value: Value,
        hash_table: *HashTable,
        status: enum { new, existing },

        pub fn add(self: *@This(), name: *String, value: *const Value) void {
            if (php.getValueType(&self.value) == .array) {
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
            };
        } else {
            const value = switch (is_tuple) {
                true => php.createValueArray(null),
                false => php.createValueObject(null),
            };
            php.setHashEntry(&self.plain_object_table, key, &value);
            return .{
                .value = value,
                .hash_table = php.getValueHashTable(&value) catch unreachable,
                .status = .new,
            };
        }
    }

    pub fn removePlainObject(self: *@This(), obj: *Object) void {
        const key: i32 = @bitCast(obj.handle);
        _ = php.removeHashEntry(&self.plain_object_table, key);
    }

    pub fn isRedirecting(self: *@This()) bool {
        return self.module.attributes.io_redirection;
    }

    pub fn useRuntimeSafety(self: *@This()) bool {
        return self.module.attributes.runtime_safety;
    }

    pub fn findException(self: *@This(), key: anytype) ?*ZigException {
        const entry = php.getHashEntry(&self.exception_table, key) catch return null;
        return ZigException.fromValue(entry) catch unreachable;
    }

    pub fn addException(self: *@This(), name: *String, code: Long) !*ZigException {
        const ex_obj: *Object = try ZigException.create(name, code);
        defer php.release(ex_obj);
        const ex_struct = ZigException.fromObject(ex_obj);
        const ex_value = php.createValueObject(ex_obj);
        const message = php.getValueString(&ex_struct.message) catch unreachable;
        php.setHashEntryRef(&self.exception_table, name, &ex_value);
        php.setHashEntryRef(&self.exception_table, message, &ex_value);
        php.setHashEntryRef(&self.exception_table, code, &ex_value);
        return ex_struct;
    }

    pub fn getAllocator(self: *@This(), allocator_class: *ZigClassEntry) !std.mem.Allocator {
        if (self.allocator_vtable == null) {
            const enum_fields = std.meta.fields(AllocatorMethodId);
            const vtable_ptr_class = if (allocator_class.getMember(.instance, N("vtable"))) |m| m.class else |_| return error.Unexpected;
            const vtable_class = if (vtable_ptr_class.getMember(.instance, 0)) |m| m.class else |_| return error.Unexpected;
            const exports = self.module.exports;
            var vtable: std.mem.Allocator.VTable = undefined;
            var failure_index: usize = undefined;
            errdefer {
                inline for (enum_fields, 0..) |field, i| {
                    if (i == failure_index) break;
                    const thunk_address = @intFromPtr(@field(vtable, field.name));
                    var fn_id: usize = undefined;
                    const controller_address = self.allocator_controllers[i];
                    _ = exports.destroy_js_thunk(controller_address, thunk_address, &fn_id);
                }
            }
            inline for (enum_fields, 0..) |field, i| {
                errdefer failure_index = i;
                const ptr_class = if (vtable_class.getMember(.instance, N(field.name))) |m| m.class else |_| return error.Unexpected;
                const fn_class = if (ptr_class.getMember(.instance, 0)) |m| m.class else |_| return error.Unexpected;
                const fn_static = fn_class.getStaticData(structure.Function);
                const fn_id = @intFromEnum(@field(AllocatorMethodId, field.name));
                const controller_address = fn_static.controller_address;
                var thunk_address: usize = 0;
                const result = exports.create_js_thunk(controller_address, fn_id, &thunk_address);
                if (result != .SUCCESS) return error.Failure;
                @field(vtable, field.name) = @ptrFromInt(thunk_address);
                self.allocator_controllers[i] = controller_address;
            }
            self.allocator_vtable = vtable;
        }
        return .{ .ptr = self, .vtable = &self.allocator_vtable.? };
    }

    pub fn freeAllocatorVTable(self: *@This()) void {
        const vtable = self.allocator_vtable orelse return;
        const enum_fields = std.meta.fields(AllocatorMethodId);
        const exports = self.module.exports;
        inline for (enum_fields, 0..) |field, i| {
            const controller_address = self.allocator_controllers[i];
            const thunk_address = @intFromPtr(@field(vtable, field.name));
            var fn_id: usize = undefined;
            _ = exports.destroy_js_thunk(controller_address, thunk_address, &fn_id);
        }
    }

    pub fn handleAllocatorMethodCall(fd_id: usize, arg_bytes: []u8) !E {
        const method_id: AllocatorMethodId = @enumFromInt(fd_id);
        switch (method_id) {
            inline else => |t| {
                const method = @field(allocator_methods, @tagName(t));
                const Method = @TypeOf(method);
                const Args = ArgStruct(Method);
                if (@sizeOf(Args) != arg_bytes.len) return error.SizeMismatch;
                const args: *Args = @ptrCast(@alignCast(arg_bytes.ptr));
                var arg_tuple: std.meta.ArgsTuple(Method) = undefined;
                inline for (&arg_tuple, 0..) |*arg_ptr, i| {
                    arg_ptr.* = @field(args, std.fmt.comptimePrint("{d}", .{i}));
                }
                args.retval = @call(.auto, method, arg_tuple);
                return .SUCCESS;
            },
        }
    }

    fn allocateMemory(host: *ModuleHost, len: usize, alignment: std.mem.Alignment) !*ByteBuffer {
        const buf = try ByteBuffer.create(alignment);
        errdefer buf.release();
        try buf.allocate(null, len);
        const result = host.unclaimed_buffer_map.find(buf);
        try host.unclaimed_buffer_map.insert(result, buf);
        return buf;
    }

    fn freeMemory(host: *ModuleHost, memory: []u8, alignment: std.mem.Alignment) void {
        // try releasing buffer that has just been allocated
        const unclaimed_result = host.unclaimed_buffer_map.find(.{
            .bytes = memory,
            .alignment = alignment,
        });
        if (host.unclaimed_buffer_map.get(unclaimed_result)) |buf| {
            defer host.unclaimed_buffer_map.remove(unclaimed_result);
            buf.release();
        } else {
            // failing that, look for a buffer that's being used by an object
            // and free its memory, without releasing the buffer itself
            // multiple objects can potentially be referencing the same memory range
            host.object_map.free(.{ .bytes = memory });
        }
    }

    const allocator_methods = struct {
        fn alloc(
            host: *ModuleHost,
            len: usize,
            alignment: std.mem.Alignment,
            _: usize,
        ) ?[*]u8 {
            const buf = host.allocateMemory(len, alignment) catch return null;
            return buf.bytes.ptr;
        }

        fn resize(
            _: *ModuleHost,
            memory: []u8,
            _: std.mem.Alignment,
            new_len: usize,
            _: usize,
        ) bool {
            return new_len <= memory.len;
        }

        fn remap(
            host: *ModuleHost,
            memory: []u8,
            alignment: std.mem.Alignment,
            new_len: usize,
            return_address: usize,
        ) ?[*]u8 {
            if (resize(host, memory, alignment, new_len, return_address)) {
                return memory.ptr;
            }
            return null;
        }

        fn free(
            host: *ModuleHost,
            memory: []u8,
            alignment: std.mem.Alignment,
            _: usize,
        ) void {
            return host.freeMemory(memory, alignment);
        }
    };
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
