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
const ReturnType = php.util.ReturnType;

pub fn @"fn"(comptime T: type) type {
    const decl_names = std.meta.declarations(T);
    return struct {
        pub fn class() *Class {
            return class_entry;
        }

        pub fn registerClass(name: *String, parent_class: ?*Class) !void {
            const custom_ce: *Class.Custom(T) = try .create(name, parent_class);
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
            // initialize the custom part
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

        pub fn getIterator(object: *Object) ?*Object.Iterator {
            if (!@hasDecl(T, "init")) {
                failure.throw(error.IllegalOperation);
                return null;
            }
            const self: *@This() = @ptrCast(object);
            const iter = switch (@hasDecl(T, "iterate")) {
                true => switch (argCount(@TypeOf(self.iterate()))) {
                    1 => self.iterate(),
                    2 => self.iterate(.{}),
                    else => @compileError("iterate() should have at most 1 argument containing options"),
                },
                false => switch (has_iterator) {
                    true => Object.Iterator.Properties(T, getter_names).init(object),
                    false => return null,
                },
            };
            const Iterator = @TypeOf(iter);
            return Object.Iterator.Custom(Iterator).create(iter);
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
        pub const has_iterator = @hasDecl(T, "iterate") and getter_names.len > 0;
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
            tryFreeObject(object) catch |err| {
                failure.throw(err);
            };
        }

        fn tryFreeObject(object: *Object) !void {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "freeObject")) {
                true => self.custom.freeObject(),
                false => {},
            };
        }

        fn destroyObject(object: *Object) callconv(.c) void {
            tryDestroyObject(object) catch |err| {
                failure.throw(err);
            };
        }

        fn tryDestroyObject(object: *Object) !void {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "destroyObject")) {
                true => self.custom.destroyObject(),
                false => {},
            };
        }

        fn cloneObject(object: *Object) callconv(.c) ?*Object {
            return tryCloneObject(object) catch |err| {
                failure.throw(err);
                return null;
            };
        }

        fn tryCloneObject(object: *Object) !?*Object {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "cloneObject")) {
                true => self.custom.cloneObject(),
                false => error.InvalidOperation,
            };
        }

        // Cast an object to some other type.
        fn castObject(object: *Object, retval: *Value, zv_type: c_int) callconv(.c) c.zend_result {
            if (tryCastObject(object, zv_type)) |value| {
                retval.* = value;
                return c.SUCCESS;
            } else |err| {
                failure.throw(err);
                return c.FAILURE;
            }
        }

        fn tryCastObject(object: *Object, zv_type: c_int) !Value {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "castObject")) {
                true => self.custom.castObject(.fromZvalType(zv_type)),
                false => error.InvalidOperation,
            };
        }

        fn readProperty(object: *Object, name: *String, access: Access, cache_slot: [*]*anyopaque, retval: *Value) callconv(.c) *Value {
            if (tryReadProperty(object, name, access, cache_slot)) |value| {
                retval.* = value;
            } else |err| {
                failure.throw(fieldError(name, .read, err));
                retval.* = .fromNull();
            }
            return retval;
        }

        fn tryReadProperty(object: *Object, name: *String, access: Access, cache_slot: [*]*anyopaque) !Value {
            const self: *@This() = @ptrCast(object);
            return inline for (getter_names) |n| {
                if (name.matchSlice(n)) break self.callGetter(n);
            } else switch (@hasDecl(T, "readProperty")) {
                true => switch (argCount(@TypeOf(self.custom.readProperty))) {
                    4 => self.custom.readProperty(name, access, cache_slot),
                    else => self.custom.readProperty(name, access),
                },
                false => error.UndefinedProperty,
            };
        }

        fn writeProperty(object: *Object, name: *String, value: *Value, cache_slot: [*]*anyopaque) callconv(.c) *Value {
            tryWriteProperty(object, name, value, cache_slot) catch |err| {
                failure.throw(fieldError(name, .write, err));
            };
            return value;
        }

        fn tryWriteProperty(object: *Object, name: *String, value: *Value, cache_slot: [*]*anyopaque) !void {
            const self: *@This() = @ptrCast(object);
            return inline for (setter_names) |n| {
                if (name.matchSlice(n)) break self.callSetter(n, value);
            } else switch (@hasDecl(T, "writeProperty")) {
                true => switch (argCount(@TypeOf(self.custom.readProperty))) {
                    4 => self.custom.writeProperty(name, value.*, cache_slot),
                    else => self.custom.writeProperty(name, value.*),
                },
                false => error.UndefinedProperty,
            };
        }

        fn hasProperty(object: *Object, name: *String, cache_slot: [*]*anyopaque) callconv(.c) c_int {
            return if (tryHasProperty(object, name, cache_slot)) |state| {
                return if (state) c.SUCCESS else c.FAILURE;
            } else |err| {
                failure.throw(fieldError(name, .isset, err));
                return c.FAILURE;
            };
        }

        fn tryHasProperty(object: *Object, name: *String, cache_slot: [*]*anyopaque) !bool {
            const self: *@This() = @ptrCast(object);
            return inline for (setter_names) |n| {
                if (name.matchSlice(n)) break true;
            } else switch (@hasDecl(T, "unsetProperty")) {
                true => switch (argCount(@TypeOf(self.custom.hasProperty))) {
                    3 => self.custom.hasProperty(name, cache_slot),
                    else => self.custom.hasProperty(name),
                },
                false => false,
            };
        }

        fn unsetProperty(object: *Object, name: *String, cache_slot: [*]*anyopaque) callconv(.c) void {
            return tryUnsetProperty(object, name, cache_slot) catch |err| {
                failure.throw(fieldError(name, .unset, err));
            };
        }

        fn tryUnsetProperty(object: *Object, name: *String, cache_slot: [*]*anyopaque) !void {
            const self: *@This() = @ptrCast(object);
            return inline for (setter_names) |n| {
                if (name.matchSlice(n)) break self.callSetterWithNull(n);
            } else switch (@hasDecl(T, "unsetProperty")) {
                true => switch (argCount()) {
                    3 => self.custom.unsetProperty(name),
                    else => self.custom.unsetProperty(name, cache_slot),
                },
                false => error.UndefinedProperty,
            };
        }

        fn getProperties(object: *Object) callconv(.c) ?*Array {
            const result = tryGetPropertiesFor(object, .default) catch |err| {
                failure.throw(err);
                return null;
            };
            // caller expects array without refcount
            if (result) |arr| arr.subtractRef();
            return result;
        }

        fn getPropertiesFor(object: *Object, purpose: PropertiesPurpose) callconv(.c) ?*Array {
            return tryGetPropertiesFor(object, purpose) catch |err| {
                failure.throw(err);
                return null;
            };
        }

        fn tryGetPropertiesFor(object: *Object, purpose: PropertiesPurpose) !?*Array {
            const self: *@This() = @ptrCast(object);
            const Self = @This();
            const from = struct {
                pub fn getters(s: *Self) !?*Array {
                    return switch (getter_names.len > 0) {
                        true => get: {
                            const list = Array.create();
                            inline for (getter_names) |n| {
                                const result = try s.callGetter(n);
                                list.set(String.static(n), result);
                            }
                            break :get list;
                        },
                        false => null,
                    };
                }

                pub fn handler(s: *Self, p: PropertiesPurpose) !?*Array {
                    return switch (@hasDecl(T, "getProperties")) {
                        true => s.custom.getProperties(p),
                        false => null,
                    };
                }
            };
            const list1 = try from.getters(self);
            const list2 = try from.handler(self, purpose);
            if (list1) |arr1| {
                if (list2) |arr2| {
                    // append arr2 to arr1 then release arr2
                    defer arr2.release();
                    var iter = arr2.iterate(.{});
                    while (iter.next()) |value| {
                        arr1.set(iter.key(), value);
                    }
                }
                return list1;
            } else {
                return list2;
            }
        }

        fn getPropertyPointer(object: *Object, name: *String, access: Access, cache_slot: [*]*anyopaque) callconv(.c) ?*Value {
            return tryGetPropertyPointer(object, name, access, cache_slot) catch |err| {
                failure.throw(err);
                return null;
            };
        }

        fn tryGetPropertyPointer(object: *Object, name: *String, access: Access, cache_slot: [*]*anyopaque) !?*Value {
            _ = cache_slot;
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "getPropertyPointer")) {
                true => self.custom.getPropertyPointer(name, access),
                false => error.InvalidOperation,
            };
        }

        fn readDimension(object: *Object, offset: *Value, access: Value.Access, retval: *Value) callconv(.c) *Value {
            if (tryReadDimension(object, offset, access)) |value| {
                retval.* = value;
            } else |err| {
                failure.throw(err);
                retval.* = .fromNull();
            }
            return retval;
        }

        fn tryReadDimension(object: *Object, offset: *Value, access: Value.Access) !Value {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "readDimension")) {
                true => self.custom.readDimension(offset.*, access),
                false => error.InvalidOperation,
            };
        }

        fn writeDimension(object: *Object, offset: *Value, value: *Value) callconv(.c) void {
            tryWriteDimension(object, offset, value) catch |err| {
                failure.throw(err);
            };
        }

        fn tryWriteDimension(object: *Object, offset: *Value, value: *Value) !void {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "writeDimension")) {
                true => self.custom.writeDimension(offset.*, value.*),
                false => error.InvalidOperation,
            };
        }

        fn hasDimension(object: *Object, offset: *Value, check_empty: c_int) callconv(.c) c_int {
            if (tryHasDimension(object, offset, check_empty)) |state| {
                return if (state) 1 else 0;
            } else |err| {
                failure.throw(err);
                return 0;
            }
        }

        fn tryHasDimension(object: *Object, offset: *Value, check_empty: c_int) !bool {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "hasDimension")) {
                true => self.custom.hasDimension(offset.*, check_empty != 0),
                false => error.InvalidOperation,
            };
        }

        fn unsetDimension(object: *Object, offset: *Value) callconv(.c) void {
            tryUnsetDimension(object, offset) catch |err| {
                failure.throw(err);
            };
        }

        fn tryUnsetDimension(object: *Object, offset: *Value) !void {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "unsetDimension")) {
                true => self.custom.unsetDimension(offset),
                false => error.InvalidOperation,
            };
        }

        fn countElements(object: *Object, count: *c_long) c.zend_result {
            if (tryCountElements(object)) |num| {
                count.* = @intCast(num);
                return c.SUCCESS;
            } else |err| {
                failure.throw(err);
                return c.FAILURE;
            }
        }

        fn tryCountElements(object: *Object) !usize {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "countElements")) {
                true => self.custom.countElements(),
                false => error.InvalidOperation,
            };
        }

        /// Get method
        fn getMethod(object_ptr: **Object, name: *String, key: *Value) callconv(.c) ?*const Function {
            return tryGetMethod(object_ptr, name, key) catch |err| {
                failure.throw(err);
                return null;
            };
        }

        fn tryGetMethod(object_ptr: **Object, name: *String, key: *Value) !?*const Function {
            // TODO: use key for case insensitivity
            _ = key;
            const self: *@This() = @ptrCast(object_ptr.*);
            return methods.find(name) orelse switch (@hasDecl(T, "getMethod")) {
                true => self.custom.getMethod(name),
                false => error.UndefinedMethod,
            };
        }

        /// Get constructor
        fn getConstructor(object: *Object) callconv(.c) ?*const Function {
            return tryGetConstructor(object) catch |err| {
                failure.throw(err);
                return null;
            };
        }

        fn tryGetConstructor(object: *Object) !?*const Function {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "getConstructor")) {
                true => self.custom.getConstructor(),
                false => null,
            };
        }

        /// Get class name for display in var_dump and other debugging functions.
        fn getClassName(object: *Object) callconv(.c) *String {
            return tryGetClassName(object) catch |err| {
                failure.throw(err);
                return "(error)";
            };
        }

        fn tryGetClassName(object: *Object) !*String {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "getClassName")) {
                true => self.custom.getClassName(),
                false => class_entry.name(),
            };
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
            if (tryCompareWith(object, value)) |result| {
                return result * multiplier;
            } else |err| {
                failure.throw(err);
                return 1;
            }
        }

        fn tryCompareWith(object: *Object, value: Value) !c_int {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "compareWith")) {
                true => self.custom.compareWith(value),
                false => error.IllegalOperation,
            };
        }

        fn getClosure(object: *Object, class_ptr: *?*Class, func_ptr: *?*Function, obj_ptr: *?*Object, check_only: bool) callconv(.c) c.zend_result {
            if (tryGetClosure(object, check_only)) |closure| {
                class_ptr.* = closure.class;
                func_ptr.* = closure.function;
                obj_ptr.* = closure.object;
                return c.SUCCESS;
            } else |err| {
                failure.throw(err);
                return c.FAILURE;
            }
        }

        fn tryGetClosure(object: *Object, check_only: bool) !ClosureResult {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "getClosure")) {
                true => self.custom.getClosure(check_only),
                false => error.IllegalOperation,
            };
        }

        fn getGarbageCollection(object: *Object, table: *?[*]const *Value, n: *c_int) callconv(.c) ?*const Array {
            const gc = tryGetGarbageCollection(object) catch |err| get: {
                failure.throw(err);
                break :get .{};
            };
            table.* = if (gc.slice.len > 0) gc.slice.ptr else null;
            n.* = @intCast(gc.slice.len);
            return gc.array;
        }

        fn tryGetGarbageCollection(object: *Object) !GarbageCollectionResult {
            const self: *@This() = @ptrCast(object);
            return switch (@hasDecl(T, "getGarbageCollection")) {
                true => self.custom.getGarbageCollection(&self.custom),
                false => GarbageCollectionResult{},
            };
        }

        fn doOperation(opcode: Opcode, retval: *Value, op1: *Value, op2: *Value) callconv(.c) c.zend_result {
            if (tryDoOperation(opcode, op1, op2)) |value| {
                retval.* = value;
                return c.SUCCESS;
            } else |err| {
                failure.throw(err);
                retval.* = .fromNull();
                return c.FAILURE;
            }
        }

        fn tryDoOperation(opcode: Opcode, op1: *Value, op2: *Value) !Value {
            return switch (@hasDecl(T, "doOperation")) {
                true => T.doOperation(opcode, op1.*, op2.*),
                false => error.IllegalOperation,
            };
        }

        fn fieldError(name: *String, access: Value.Access, err: anytype) error{FailureReported} {
            if (failure.match(err, error.FailureReported)) {
                return error.FailureReported;
            } else if (failure.match(err, error.UndefinedProperty)) {
                return failure.report("no field named '{s}' in {s}", .{
                    name.slice(),
                    class_entry.name().slice(),
                });
            } else {
                const message = failure.acquireMessage(err);
                defer failure.freeMessage(message);
                return failure.report("unable to {s} field '{s}' in {s}: {s}", .{
                    @tagName(access),
                    name.slice(),
                    class_entry.name().slice(),
                    message,
                });
            }
        }

        fn callGetter(self: *@This(), comptime prop_name: []const u8) !Value {
            const get = @field(T, "get " ++ prop_name);
            const payload = get(&self.custom);
            return Value.fromAny(payload);
        }

        fn callSetter(self: *@This(), comptime prop_name: []const u8, value: *Value) !void {
            const set = @field(T, "set " ++ prop_name);
            const PT = ArgType(@TypeOf(set), 1);
            const payload = value.convertTo(PT);
            return set(&self.custom, payload);
        }

        fn callSetterWithNull(self: *@This(), comptime prop_name: []const u8) !void {
            const set = @field(T, "set " ++ prop_name);
            const PT = ArgType(@TypeOf(set), 1);
            return if (@typeInfo(PT) == .optional) set(&self.custom, null) else error.InvalidOperation;
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
