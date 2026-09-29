const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const php_al = php.allocator;
const pi = php.imports;
const Array = php.Array;
const Class = php.Class;
const failure = php.failure;
const Function = php.Function;
const Object = php.Object;
const ClosureResult = Object.ClosureResult;
const GarbageCollectionResult = Object.GarbageCollectionResult;
const Opcode = Object.Opcode;
const PropertiesPurpose = Object.PropertiesPurpose;
const String = php.String;
const Value = php.Value;
const Access = Value.Access;
const Kind = Value.Kind;
const argCount = php.util.argCount;
const ArgType = php.util.ArgType;

pub fn @"fn"(comptime T: type) type {
    const decl_names = std.meta.declarations(T);
    return struct {
        pub fn class() *Class {
            return class_entry;
        }

        pub fn registerClass(name: *String) !void {
            const custom_ce: *Class.Custom(T) = try .create(name, null);
            errdefer custom_ce.release();
            try custom_ce.register();
            class_entry = @ptrCast(custom_ce);
        }

        pub fn unregisterClass() void {
            const custom_ce: *Class.Custom(T) = @ptrCast(class_entry);
            custom_ce.unregister();
            custom_ce.release();
        }

        pub fn create(initializers: Initializers) !*@This() {
            // not using properties_table in zval
            const size: usize = @offsetOf(@This(), "object") + @offsetOf(c.zend_object, "properties_table");
            const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(@This()));
            const byte_ptr = php_al.rawAlloc(size, alignment, @returnAddress()).?;
            errdefer php_al.rawFree(byte_ptr[0..size], alignment, @returnAddress());
            const self: *@This() = @ptrCast(@alignCast(byte_ptr));
            // initialize the PHP portion
            pi.zend_object_std_init(@ptrCast(&self.object), @ptrCast(class_entry));
            // handlers need to be set after zend_object_std_init() due to change in PHP 8.3
            self.object.impl.handlers = &handlers;
            // initialize the
            if (@hasDecl(T, "init")) {
                const Init = @TypeOf(T.init);
                const RT = @typeInfo(Init).@"fn".return_type.?;
                self.custom = switch (@typeInfo(RT)) {
                    .error_union => try T.init(initializers),
                    else => T.init(initializers),
                };
            } else {
                self.custom = .{};
            }
            return self;
        }

        pub fn fromCustom(custom: *T) *@This() {
            return @fieldParentPtr("custom", custom);
        }

        pub const Custom = T;
        pub const Initializers = init: {
            if (@hasDecl(T, "init")) {
                const Init = @TypeOf(T.init);
                break :init ArgType(Init, 0);
            } else {
                break :init struct {};
            }
        };
        pub const handler_protypes = .{
            .freeObject = fn (*T) void,
            .destroyObject = fn (*T) void,
            .cloneObject = fn (*T) ?*Object,
            .castObject = fn (*T, Kind) ?*Object,
            .readProperty = .{
                fn (*T, *String, Access) Value,
                fn (*T, *String, Access, ?[*]?*anyopaque) Value,
            },
            .writeProperty = .{
                fn (*T, *String, Value) void,
                fn (*T, *String, Value, ?[*]?*anyopaque) void,
            },
            .hasProperty = .{
                fn (*T, *String) bool,
                fn (*T, *String, ?[*]?*anyopaque) bool,
            },
            .unsetProperty = .{
                fn (*T, *String) void,
                fn (*T, *String, ?[*]?*anyopaque) void,
            },
            .getProperties = .{
                fn (*T, PropertiesPurpose) void,
            },
            .getPropertyPointer = .{
                fn (*T, *String, Access) ?*Value,
                fn (*T, *String, Access, ?[*]?*anyopaque) ?*Value,
            },
            .readDimension = fn (*T, Value, Access) Value,
            .writeDimension = fn (*T, Value, Value) void,
            .hasDimension = fn (*T, Value, bool) void,
            .unsetDimension = fn (*T, Value) void,
            .countElements = fn (*T, Value) usize,
            .getMethod = .{
                fn (*T, *String) usize,
                fn (*T, *String, Value) usize,
            },
            .getConstructor = fn (*T) *Function,
            .getClassName = fn (*T) *String,
            .compareWith = fn (*T, Value) c_int,
            .getClosure = fn (*T, bool) ClosureResult,
            .getGarbageCollection = fn (*T) GarbageCollectionResult,
            .doOperation = fn (u8, Value, Value) Value,
        };

        fn freeObject(object: *Object) callconv(.c) void {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "freeObject")) return;
            const result = self.custom.freeObject();
            failure.inspect(result, {});
        }

        fn destroyObject(object: *Object) callconv(.c) void {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "destroyObject")) return;
            const result = self.custom.destroyObject();
            failure.inspect(result, {});
        }

        fn cloneObject(object: *Object) callconv(.c) ?*Object {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "cloneObject")) {
                failure.throw(error.InvalidOperation);
                return null;
            }
            const result = self.custom.cloneObject();
            return failure.inspect(result, null);
        }

        // Cast an object to some other type.
        fn castObject(object: *Object, retval: *Value, zv_type: c_int) callconv(.c) c.zend_result {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "castObject")) {
                failure.throw(error.InvalidOperation);
                return c.FAILURE;
            }
            const result = self.custom.castObject(.fromZvalType(zv_type));
            retval.* = failure.inspect(result, .fromNull());
            return failure.zendResult(result);
        }

        fn readProperty(object: *Object, name: *String, access: Access, cache_slot: [*]*anyopaque, retval: *Value) callconv(.c) *Value {
            const self: *@This() = @ptrCast(object);
            const result = inline for (getter_names) |n| {
                if (name.matchSlice(n)) {
                    const get = @field(T, "get " ++ n);
                    const payload = get(&self.custom);
                    break Value.fromAny(payload);
                }
            } else switch (@hasDecl(T, "readProperty")) {
                true => switch (argCount(@TypeOf(self.custom.readProperty))) {
                    4 => self.custom.readProperty(name, access, cache_slot),
                    else => self.custom.readProperty(name, access),
                },
                false => fail: {
                    failure.throw(error.UndefinedProperty);
                    break :fail Value.fromNull();
                },
            };
            retval.* = failure.inspect(result, .fromNull());
            return retval;
        }

        fn writeProperty(object: *Object, name: *String, value: *Value, cache_slot: [*]*anyopaque) callconv(.c) *Value {
            const self: *@This() = @ptrCast(object);
            const result = inline for (setter_names) |n| {
                if (name.matchSlice(n)) {
                    const set = @field(T, "set " ++ name);
                    const PT = ArgType(@TypeOf(set), 1);
                    const payload = value.convertTo(PT);
                    break set(&self.custom, payload);
                }
            } else switch (@hasDecl(T, "writeProperty")) {
                true => switch (argCount(@TypeOf(self.custom.readProperty))) {
                    4 => self.custom.writeProperty(name, value.*, cache_slot),
                    else => self.custom.writeProperty(name, value.*),
                },
                false => failure.throw(error.UndefinedProperty),
            };
            failure.inspect(result, {});
            return value;
        }

        fn hasProperty(object: *Object, name: *String, cache_slot: [*]*anyopaque) callconv(.c) c_int {
            const self: *@This() = @ptrCast(object);
            const result = inline for (setter_names) |n| {
                if (name.matchSlice(n)) break true;
            } else switch (@hasDecl(T, "unsetProperty")) {
                true => switch (argCount(@TypeOf(self.custom.hasProperty))) {
                    3 => self.custom.hasProperty(name, cache_slot),
                    else => self.custom.hasProperty(name),
                },
                false => false,
            };
            const state = failure.inspect(result, false);
            return if (state) c.SUCCESS else c.FAILURE;
        }

        fn unsetProperty(object: *Object, name: *String, cache_slot: [*]*anyopaque) callconv(.c) void {
            const self: *@This() = @ptrCast(object);
            const result = inline for (setter_names) |n| {
                if (name.matchSlice(n)) {
                    const set = @field(T, "set " ++ name);
                    const PT = ArgType(@TypeOf(set), 1);
                    if (@typeInfo(PT) == .optional) {
                        break set(&self.custom, null);
                    } else {
                        break error.InvalidOperation;
                    }
                }
            } else switch (@hasDecl(T, "unsetProperty")) {
                true => switch (argCount()) {
                    3 => self.custom.unsetProperty(name),
                    else => self.custom.unsetProperty(name, cache_slot),
                },
                false => failure.throw(error.UndefinedProperty),
            };
            failure.inspect(result, {});
        }

        fn getProperties(object: *Object) ?*Array {
            const result = getPropertiesFor(object, .default);
            // caller expects array without refcount
            if (result) |arr| arr.subtractRef();
            return result;
        }

        fn getPropertiesFor(object: *Object, purpose: PropertiesPurpose) ?*Array {
            const self: *@This() = @ptrCast(object);
            const list1: ?*Array = switch (getter_names.len) {
                0 => null,
                else => get: {
                    const list = Array.create();
                    inline for (getter_names) |getter_name| {
                        const get = @field(T, "get " ++ getter_name);
                        const payload = get(&self.custom);
                        const result = Value.fromAny(payload);
                        const entry = failure.inspect(result, .fromNull());
                        list.set(String.static(getter_name), entry);
                    }
                    break :get list;
                },
            };
            const list2: ?*Array = switch (@hasDecl(T, "unsetProperty")) {
                false => null,
                true => get: {
                    const result = self.custom.getPropertiesFor(purpose);
                    break :get failure.inspect(result, null);
                },
            };
            if (list1) |arr1| {
                if (list2) |arr2| {
                    // append arr2 to arr1 then release arr2
                    defer arr2.release();
                    var iter = arr2.iterate();
                    while (iter.next()) |value| {
                        arr1.set(iter.key(), value);
                    }
                }
                return list1;
            } else {
                return list2;
            }
        }

        fn getPropertyPointer(object: *Object, name: *String, access: Access, cache_slot: [*]*anyopaque) ?*Value {
            _ = cache_slot;
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "writeDimension")) {
                failure.throw(error.InvalidOperation);
                return null;
            }
            const result = self.custom.getPropertyPointer(name, access);
            return failure.inspect(result, null);
        }

        fn readDimension(object: *Object, offset: *Value, access: Value.Access, retval: *Value) callconv(.c) *Value {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "readDimension")) {
                failure.throw(error.InvalidOperation);
                retval.* = .fromNull();
                return retval;
            }
            const result = self.custom.readDimension(offset.*, access);
            retval.* = failure.inspect(result, .fromNull());
            return retval;
        }

        fn writeDimension(object: *Object, offset: *Value, value: *Value) callconv(.c) void {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "writeDimension")) return failure.throw(error.InvalidOperation);
            const result = self.custom.writeDimension(offset.*, value.*);
            failure.inspect(result, {});
        }

        fn hasDimension(object: *Object, offset: *Value, check_empty: c_int) callconv(.c) c_int {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "hasDimension")) {
                failure.throw(error.InvalidOperation);
                return 0;
            }
            const result = self.custom.hasDimension(offset.*, check_empty != 0);
            const exists = failure.inspect(result, false);
            return if (exists) 1 else 0;
        }

        fn unsetDimension(object: *Object, offset: *Value) callconv(.c) void {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "unsetDimension")) return failure.throw(error.InvalidOperation);
            const result = self.custom.unsetDimension(offset);
            failure.inspect(result, {});
        }

        fn countElements(object: *Object, count: *c_long) c.zend_result {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "countElements")) {
                failure.throw(error.InvalidOperation);
                return c.FAILURE;
            }
            const result = self.custom.countElements();
            count.* = @intCast(failure.inspect(result, 0));
            return failure.zendResult(result);
        }

        /// Get method
        fn getMethod(object_ptr: **Object, name: *String, key: *Value) callconv(.c) ?*const Function {
            // TODO: use key for case insensitivity
            _ = key;
            const self: *@This() = @ptrCast(object_ptr.*);
            const result = methods.find(name) orelse get: {
                if (!@hasDecl(T, "getMethod")) {
                    failure.throw(error.UndefinedMethod);
                    break :get null;
                }
                break :get self.custom.getMethod(name);
            };
            return failure.inspect(result, null);
        }

        /// Get constructor
        fn getConstructor(object: *Object) callconv(.c) ?*const Function {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "getConstructor")) return null;
            const result = self.custom.getConstructor();
            return failure.inspect(result, null);
        }

        /// Get class name for display in var_dump and other debugging functions.
        fn getClassName(object: *Object) callconv(.c) *String {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "getClassName")) return class_entry.name();
            const result = self.custom.getClassName(&self.custom);
            return failure.inspect(result, "(error occurred)");
        }

        /// Compare object to value given
        fn compareWith(value1: Value, value2: Value) c_int {
            const object, const value, const multiplier: c_int = init: {
                if (value1.kind() == .object) {
                    const obj = value1.object();
                    if (obj.isInstanceOf(class_entry)) break :init .{ obj, value2, 1 };
                }
                if (value2.kind() == .object) {
                    const obj = value2.object();
                    if (obj.isInstanceOf(class_entry)) break :init .{ obj, value1, -1 };
                }
                unreachable;
            };
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "compareWith")) {
                failure.throw(error.IllegalOperation);
                return 1;
            }
            const result = self.custom.compareWith(value);
            return failure.inspect(result, 1) * multiplier;
        }

        fn getClosure(object: *Object, class_ptr: *?*Class, func_ptr: *?*Function, obj_ptr: *?*Object, check_only: bool) callconv(.c) c.zend_result {
            const self: *@This() = @ptrCast(object);
            if (!@hasDecl(T, "getClosure")) {
                failure.throw(error.IllegalOperation);
                return c.FAILURE;
            }
            const result = self.custom.getClosure(check_only);
            const cl = failure.inspect(result, null);
            class_ptr.* = cl.class;
            func_ptr.* = cl.function;
            obj_ptr.* = cl.object;
            return failure.zendResult(result);
        }

        fn getGarbageCollection(object: *Object, table: *?[*]const *Value, n: *c_int) callconv(.c) ?*const Array {
            const self: *@This() = @ptrCast(object);
            const result = switch (@hasDecl(T, "getGarbageCollection")) {
                true => self.custom.getGarbageCollection(&self.custom),
                false => GarbageCollectionResult{},
            };
            const gc = failure.inspect(result, .{});
            table.* = if (gc.slice.len > 0) gc.slice.ptr else null;
            n.* = @intCast(gc.slice.len);
            return gc.array;
        }

        fn doOperation(opcode: Opcode, retval: *Value, op1: *Value, op2: *Value) callconv(.c) c.zend_result {
            if (!@hasDecl(T, "doOperation")) {
                failure.throw(error.IllegalOperation);
                return c.FAILURE;
            }
            const result = T.doOperation(opcode, op1.*, op2.*);
            retval.* = failure.inspect(result, .fromNull());
            return failure.zendResult(result);
        }

        fn getMethodName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                const prefix = "call ";
                if (std.mem.startsWith(u8, decl_name, prefix)) return decl_name[prefix.len..];
            }
            return null;
        }

        fn getGetterName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                const prefix = "get ";
                if (std.mem.startsWith(u8, decl_name, prefix)) {
                    const correct = check: {
                        const f = @typeInfo(Decl).@"fn";
                        // check param count: self
                        if (f.param_types.len != 1) break :check false;
                        // check self pointer
                        switch (@typeInfo(f.param_types[0].?)) {
                            .pointer => |pt| break :check pt.child == T,
                            else => break :check false,
                        }
                    };
                    if (!correct) @compileError("Invalid getter: @\"" ++ decl_name ++ "\": " ++ @typeName(Decl));
                    return decl_name[prefix.len..];
                }
            }
            return null;
        }

        fn getSetterName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                const prefix = "set ";
                if (std.mem.startsWith(u8, decl_name, prefix)) {
                    const correct = check: {
                        const f = @typeInfo(Decl).@"fn";
                        // check param count: self + value
                        if (f.param_types.len != 2) break :check false;
                        // check self pointer
                        switch (@TypeOf(f.param_types[0].?)) {
                            .pointer => |pt| if (pt.child != T) break :check false,
                            else => break :check false,
                        }
                        // check return value
                        switch (@TypeOf(f.return_type.?)) {
                            .void => break :check true,
                            .error_union => |eu| break :check eu.child == void,
                            else => break :check false,
                        }
                    };
                    if (!correct) @compileError("Invalid setter: @\"" ++ decl_name ++ "\": " ++ @typeName(Decl));
                    return decl_name[prefix.len..];
                }
            }
            return null;
        }

        const getter_names = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getGetterName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var names: [count][:0]const u8 = undefined;
            for (decl_names) |decl_name| {
                if (getGetterName(decl_name)) |n| {
                    names[i] = n;
                    i += 1;
                }
            }
            break :init names;
        };
        const setter_names = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getSetterName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var names: [count][:0]const u8 = undefined;
            for (decl_names) |decl_name| {
                if (getSetterName(decl_name)) |n| {
                    names[i] = n;
                    i += 1;
                }
            }
            break :init names;
        };
        const method_names = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getMethodName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var names: [count][:0]const u8 = undefined;
            for (decl_names) |decl_name| {
                if (getMethodName(decl_name)) |n| {
                    names[i] = n;
                    i += 1;
                }
            }
            break :init names;
        };
        const Methods = Object.MethodSet(method_names);
        const methods: Methods = .fromType(T, "call ");
        const handlers: Object.Handlers = .{
            .free_obj = @ptrCast(&freeObject),
            .dtor_obj = @ptrCast(&destroyObject),
            .clone_obj = @ptrCast(&cloneObject),
            .read_property = @ptrCast(&readProperty),
            .write_property = @ptrCast(&writeProperty),
            .read_dimension = @ptrCast(&readDimension),
            .write_dimension = @ptrCast(&writeDimension),
            .get_property_ptr_ptr = @ptrCast(&getPropertyPointer),
            .has_property = @ptrCast(&hasProperty),
            .unset_property = @ptrCast(&unsetProperty),
            .get_properties = @ptrCast(&getProperties),
            .get_properties_for = @ptrCast(&getPropertiesFor),
            .has_dimension = @ptrCast(&hasDimension),
            .unset_dimension = @ptrCast(&unsetDimension),
            .get_method = @ptrCast(&getMethod),
            .get_constructor = @ptrCast(&getConstructor),
            .get_class_name = @ptrCast(&getClassName),
            .cast_object = @ptrCast(&castObject),
            .count_elements = @ptrCast(&countElements),
            .get_closure = @ptrCast(&getClosure),
            .get_gc = @ptrCast(&getGarbageCollection),
            .do_operation = @ptrCast(&doOperation),
            .compare = @ptrCast(&compareWith),
        };
        var class_entry: *Class = undefined;

        object: Object align(@max(@alignOf(Object), @alignOf(T))),
        custom: T,

        comptime {
            if (@offsetOf(@This(), "object") != 0) {
                @compileError("object is in the wrong position");
            }
        }
    };
}
