const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const Error = failure.Error;
const iterator = @import("../iterator.zig");
const ArrayBuffer = @import("../js-compat.zig").ArrayBuffer;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub fn Class(comptime S: type) type {
    return struct {
        constructor: Function = undefined,
        stringifier: Function = undefined,
        closure: Closure = undefined,
        table: Value = undefined,

        pub const scope: ZigClassEntry.ScopeType = .static;
        pub const Super = structure.StructLike(@This());
        pub const Self = @This();
        pub const Closure = struct {
            self: *Self,
            php_portion: Function,
        };

        pub fn finalize(self: *@This(), _: bool) !void {
            self.constructor = php.createTransformedFunction(handleConstruct, "__construct", 0, true);
            self.stringifier = php.createTransformedFunction(handleStringify, "__tostring", 0, true);
            // create closure for casting string to Zig object
            self.closure = .{
                .self = self,
                .php_portion = php.createTransformedFunction(handleCast, "cast", 1, false),
            };
        }

        pub fn setStorage(self: *@This(), table: *const Value) !void {
            // class objects reference the static template table
            self.table = table.*;
        }

        pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
            switch (transform) {
                .plain => {
                    const obj = ZigObject(@This()).fromStructure(self).object();
                    const class = ZigClassEntry.fromStructure(self);
                    var plain = class.host.getPlainObject(obj, false);
                    if (plain.status == .existing) return plain.value;
                    defer class.host.removePlainObject(obj);
                    var iter: iterator.PropertyIterator(@This()) = .init(obj);
                    defer iter.deinit();
                    while (iter.next()) |prop_value| {
                        try transform.apply(prop_value);
                        plain.add(iter.current_name.?, prop_value);
                    }
                    return plain.value;
                },
                else => {},
            }
            return Super.getValue(self, transform);
        }

        pub fn setValue(_: *@This(), _: *const Value, _: accessor.Transform) !void {
            return error.WriteProtected;
        }

        pub fn freeObject(obj: *Object) void {
            const class = ZigClassEntry.fromObject(obj);
            // const self = fromObject(obj);
            // std.debug.print("freeObject: {s} => Class({}), object {d}, {x}, refcount = {d}\n", .{ class.getName(), S, obj.handle, @intFromPtr(self), obj.gc.refcount });
            // destroy the class entry
            class.destroy();
        }

        pub fn getProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) Error!Value {
            return Super.getProperty(self, name, cache_slot) catch |err| get: {
                if (@hasDecl(S, "Static") and @hasDecl(S.Static, "getStaticProperty")) {
                    if (err == error.Missing) {
                        const class = ZigClassEntry.fromObject(object(self));
                        const static = class.getStaticData(S);
                        break :get try static.getStaticProperty(name, cache_slot);
                    }
                }
                break :get err;
            };
        }

        pub fn setProperty(self: *@This(), name: *String, value: *const Value, cache_slot: ?[*]?*anyopaque) Error!void {
            return Super.setProperty(self, name, value, cache_slot) catch |err| get: {
                if (@hasDecl(S, "Static") and @hasDecl(S.Static, "setStaticProperty")) {
                    if (err == error.Missing) {
                        const class = ZigClassEntry.fromObject(object(self));
                        const static = class.getStaticData(S);
                        break :get try static.setStaticProperty(name, value, cache_slot);
                    }
                }
                break :get err;
            };
        }

        pub fn propertyExists(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return Super.propertyExists(self, name, cache_slot) or check: {
                if (@hasDecl(S, "Static") and @hasDecl(S.Static, "staticPropertyExists")) {
                    const class = ZigClassEntry.fromObject(object(self));
                    const static = class.getStaticData(S);
                    break :check static.staticPropertyExists(name, cache_slot);
                }
                break :check false;
            };
        }

        pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*Function {
            const obj = obj_ptr.*;
            const self = fromObject(obj);
            const field = self.getProperty(name, null) catch return null;
            defer php.release(&field);
            const field_obj = php.getValueObject(&field) catch return null;
            const field_class = ZigClassEntry.fromObject(field_obj);
            if (field_obj == field_class.object) {
                // field is a type--it's being used as a casting operator
                const class_struct = fromObject(field_obj);
                return &class_struct.closure.php_portion;
            } else {
                const func_obj = switch (field_class.type) {
                    .function => field_obj,
                    .pointer => deref: {
                        const ptr_struct = structure.Pointer.fromObject(field_obj);
                        const target_obj = ptr_struct.getTarget() catch return null;
                        const target_class = ZigClassEntry.fromObject(target_obj);
                        if (target_class.type != .function) return null;
                        break :deref target_obj;
                    },
                    else => return null,
                };
                const func_struct = structure.Function.fromObject(func_obj);
                const func = &func_struct.closure.php_portion;
                func.internal_function.function_name = name;
                return func;
            }
        }

        pub fn getClosure(obj: *Object, _: *[*c]ClassEntry, fn_ptr: *[*c]Function, _: *[*c]Object, _: bool) c_int {
            // the class reference object functions as a casting operator when called
            const self = fromObject(obj);
            fn_ptr.* = &self.closure.php_portion;
            return php.SUCCESS;
        }

        pub fn compare(a: *Value, b: *Value) !c_int {
            const obj_a = php.getValueObject(a) catch return -1;
            const obj_b = php.getValueObject(b) catch return 1;
            if (obj_a.ce != obj_b.ce) {
                return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
            }
            return 0;
        }

        pub fn getGarbageCollection(obj: *Object, table: *[*c]Value, n: *c_int) !?*HashTable {
            const class = ZigClassEntry.fromObject(obj);
            const gc_buffer = class.host.gc_buffer.start(obj);
            var member_iter = class.getMemberIterator(.instance);
            while (member_iter.next()) |member| {
                // ignore properties, as the return type of getters are already reachable via their function object
                // finalizeStructure() in class-entry.zig doesn't put a reference on the member class
                if (member.accessors == .property) continue;
                if (member.class == class) continue;
                try gc_buffer.addObject(member.class.object);
            }
            if (class.instance.template.table) |*tbl| try gc_buffer.add(tbl);
            if (class.static.template.table) |*tbl| try gc_buffer.add(tbl);
            gc_buffer.use(table, n);
            return null;
        }

        pub fn getIterator(obj: *Object) !?*ObjectIterator {
            return try iterator.PropertyIterator(@This()).create(obj);
        }

        pub fn handleCast(ed: *ExecuteData, return_value: *Value) !void {
            const func: *Function = @ptrCast(ed.func);
            const closure: *Closure = @fieldParentPtr("php_portion", func);
            const self: *@This() = closure.self;
            const class = ZigClassEntry.fromStructure(self);
            var arg_iter: ArgumentIterator = .init(ed);
            if (arg_iter.len != 1) {
                return failure.report("casting operation expects 1 argument, received {d}", .{
                    arg_iter.total,
                });
            }
            const arg = arg_iter.next().?;
            const static = class.getStaticData(S);
            const Static = @TypeOf(static.*);
            // certain types like enum can cast from other types
            if (@typeInfo(Static) == .@"struct" and @hasDecl(Static, "castValue")) {
                if (try static.castValue(arg)) |value| {
                    return_value.* = value;
                    return;
                }
            }
            const buf = get: {
                if (php.getValueObject(arg) catch null) |obj| {
                    if (class.extractBuffer(obj, false)) |buf| break :get buf;
                }
                const arg_d = php.createValueDebug(arg);
                defer php.release(&arg_d);
                return failure.report("casting operation requires an ArrayBuffer or Uint8Array as argument, received {s}", .{
                    php.getValueStringContent(&arg_d) catch unreachable,
                });
            };
            const target_class = switch (class.type) {
                .pointer => class.getStaticData(structure.Pointer).target_class,
                else => class,
            };
            try target_class.validateBuffer(buf);
            const new_obj = try target_class.obtainObjectFromBuffer(buf, null);
            return_value.* = php.createValueObject(new_obj);
        }

        pub fn handleConstruct(ed: *ExecuteData, _: *Value) !void {
            if (!@hasDecl(S, "checkArguments")) unreachable;
            const this_struct = try S.fromValue(&ed.This);
            // see if an allocator is specified
            var arg_iter: ArgumentIterator = .init(ed);
            const custom_allocator = try extractAllocator(&arg_iter);
            try this_struct.checkArguments(&arg_iter);
            const arg = arg_iter.next() orelse null;
            try this_struct.initialize(custom_allocator, arg, false);
            try this_struct.finalize(true);
            if (custom_allocator != null) {
                // make buffers allocated from custom allocator external
                try this_struct.externalize();
            }
        }

        pub fn handleStringify(ed: *ExecuteData, retval: *Value) !void {
            const this_struct = try S.fromValue(&ed.This);
            // only error set implements stringify(), which adds information about where the error
            // occurred to the error message
            retval.* = try this_struct.getValue(.string);
        }

        fn extractAllocator(arg_iter: *ArgumentIterator) !?*std.mem.Allocator {
            var special_args: struct {
                allocator: ?Value = null,
            } = .{};
            arg_iter.extractNamed(&special_args, .{ .allocator = true });
            defer if (special_args.allocator) |a| php.release(&a);
            const src_value = special_args.allocator orelse return null;
            const src_obj = try php.getValueObject(&src_value);
            const src_class = ZigClassEntry.fromObject(src_obj);
            if (src_class.type != .@"struct" or src_class.purpose != .allocator) {
                return error.NotAllocator;
            }
            const src_struct = structure.Struct.fromObject(src_obj);
            return @ptrCast(@alignCast(src_struct.buffer.bytes.ptr));
        }

        pub const visitPointers = Super.Super.visitPointers;
        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const getProperties = Super.getProperties;
        pub const getPropertyPointer = Super.getPropertyPointer;
        pub const fromObject = Super.fromObject;
        const object = Super.object;
    };
}
