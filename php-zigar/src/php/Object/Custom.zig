const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const Class = php.Class;
const Function = php.Function;
const Object = php.Object;
const String = php.String;
const Value = php.Value;

pub fn @"fn"(comptime T: type) type {
    const decl_names = std.meta.declarations(T);
    return struct {
        pub fn freeObject(object: *Object) callconv(.c) void {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "freeObject")) {
                const result = self.custom.freeObject();
                _ = findError(result);
            }
        }

        pub fn destroyObject(object: *Object) callconv(.c) void {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "destroyObject")) {
                const result = self.custom.destroyObject();
                _ = findError(result);
            }
        }

        pub fn cloneObject(object: *Object) callconv(.c) ?*Object {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "cloneObject")) {
                const result = self.custom.cloneObject();
                return findPayload(result);
            }
            return null;
        }

        pub fn castObject(object: *Object, retval: *Object, zv_type: c_int) callconv(.c) c.zend_result {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "castObject")) {
                const kind: Value.Kind = .fromZvalType(zv_type);
                const result = self.custom.castObject(kind);
                retval.* = convertResult(result);
                return findPayload(result);
            }
            return c.FAILURE;
        }

        pub fn readProperty(object: *Object, name: *String, access: Value.Access, cache_slot: [*]*anyopaque, retval: *Value) callconv(.c) *Value {
            _ = cache_slot;
            const self: *@This() = fromObject(object);
            inline for (getter_names) |n| {
                if (name.matchSlice(n)) {
                    const get = @field(T, "get " ++ name);
                    const result = get(&self.custom);
                    retval.* = convertResult(result);
                    return retval;
                }
            }
            if (@hasDecl(T, "readProperty")) {
                const result = self.custom.readProperty(&self.custom, name, access);
                retval.* = convertResult(result);
            } else {
                retval.* = .fromNull();
            }
            return retval;
        }

        pub fn writeProperty(object: *Object, name: *String, value: *Value, cache_slot: [*]*anyopaque) callconv(.c) *Value {
            _ = cache_slot;
            const self: *@This() = fromObject(object);
            inline for (setter_names) |n| {
                if (name.matchSlice(n)) {
                    const set = @field(T, "set " ++ name);
                    const PT = SetterPayload(set);
                    const payload = value.convertTo(PT);
                    const result = set(&self.custom, payload);
                    _ = findError(result);
                    return value;
                }
            }
            if (@hasDecl(T, "writeProperty")) {
                const result = self.custom.writeProperty(&self.custom, name, value.*);
                _ = findError(result);
            }
            return value;
        }

        pub fn unsetProperty(object: *Object, name: *String, cache_slot: [*]*anyopaque) callconv(.c) void {
            _ = cache_slot;
            const self: *@This() = fromObject(object);
            inline for (setter_names) |n| {
                if (name.matchSlice(n)) {
                    const set = @field(T, "set " ++ name);
                    if (@typeInfo(SetterPayload(set)) == .optional) {
                        set(&self.custom, null);
                        const result = set(&self.custom, null);
                        _ = findError(result);
                    }
                    return;
                }
            }
            if (@hasDecl(T, "unsetProperty")) {
                const result = self.custom.unsetProperty(&self.custom, name);
                _ = findError(result);
            }
        }

        pub fn readDimension(object: *Object, offset: *Value, access: Value.Access, retval: *Value) callconv(.c) *Value {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "readDimension")) {
                const result = self.custom.readDimension(&self.custom, offset, access);
                retval.* = convertResult(result);
            } else {
                retval.* = .fromNull();
            }
            return retval;
        }

        pub fn writeDimension(object: *Object, offset: *Value, value: *Value) callconv(.c) void {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "writeDimension")) {
                const result = self.custom.writeDimension(&self.custom, offset, value);
                _ = findError(result);
            }
        }

        pub fn hasDimension(object: *Object, offset: *Value, check_empty: c_int) callconv(.c) c_int {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "hasDimension")) {
                const result = self.custom.hasDimension(&self.custom, offset, check_empty != 0);
                const exists = findPayload(result) orelse false;
                return if (exists) 1 else 0;
            }
            return 0;
        }

        pub fn unsetDimension(object: *Object, offset: *Value) callconv(.c) void {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "unsetDimension")) {
                const result = self.custom.unsetDimension(&self.custom, offset);
                _ = findError(result);
            }
        }

        pub fn getMethod(object_ptr: **Object, name: *String, key: *Value) callconv(.c) ?*Function {
            _ = key;
            if (methods.find(name)) |func| return func;
            if (@hasDecl(T, "getMethod")) {
                const self: *@This() = fromObject(object_ptr.*);
                const result = self.custom.getMethod(&self.custom, name);
                return findPayload(result);
            }
            return null;
        }

        pub fn getConstructor(object: *Object) callconv(.c) ?*Function {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "getConstructor")) {
                const result = self.custom.getConstructor(&self.custom);
                return findPayload(result);
            }
            return null;
        }

        pub fn getClassName(object: *Object) callconv(.c) ?*String {
            const self: *@This() = fromObject(object);
            if (@hasDecl(T, "getClassName")) {
                const result = self.custom.getClassName(&self.custom);
                return findPayload(result);
            }
            const type_name = @typeName(T);
            const si = if (std.mem.indexOfScalar(u8, type_name, '.')) |i| i + 1 orelse 0;
            return .static(type_name[si..]);
        }

        // pub fn compareObjects(value1: *Value, value2: *Value) c_int {}

        // pub fn getClosure(object: *Object, class_ptr: **Class, func_ptr: **Function, obj_ptr: **Object, check_only: bool) callconv(.c) c.zend_result {
        //     return null;
        // }

        fn fromObject(object: *Object) *@This() {
            return @fieldParentPtr("object", object);
        }

        fn findError(retval: anytype) bool {
            return switch (@typeInfo(@TypeOf(retval))) {
                .error_union => if (retval) |_| false catch |err| report: {
                    php.throwError(err);
                    break :report true;
                },
                else => false,
            };
        }

        fn findPayload(retval: anytype) ?switch (@typeInfo(@TypeOf(retval))) {
            .error_union => |eu| eu.payload,
            else => @TypeOf(retval),
        } {
            if (findError(retval)) return null;
            return retval catch unreachable;
        }

        fn convertResult(retval: anytype) Value {
            return if (findPayload(retval)) |payload| .fromAny(payload) else .fromNull();
        }

        fn getMethodName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                if (std.mem.eql(u8, decl_name[0..5], "call ")) return decl_name[5..];
            }
            return null;
        }

        fn getGetterName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                if (decl_name.len > 4 and std.mem.eql(u8, decl_name[0..4], "get ")) {
                    const correct = check: {
                        const f = @typeInfo(Decl).@"fn";
                        // check param count: self
                        if (f.param_types.len != 1) break :check false;
                        // check self pointer
                        switch (@TypeOf(f.param_types[0].?)) {
                            .pointer => |pt| if (pt.child != T) break :check false,
                            else => break :check false,
                        }
                    };
                    if (!correct) @compileError("Invalid getter: @\"" ++ decl_name ++ "\": " ++ @typeName(Decl));
                    return decl_name[4..];
                }
            }
            return null;
        }

        fn getSetterName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                if (decl_name.len > 4 and std.mem.eql(u8, decl_name[0..4], "set ")) {
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
                    return decl_name[4..];
                }
            }
            return null;
        }

        fn SetterPayload(comptime setter: anytype) type {
            return @typeInfo(@TypeOf(setter)).@"fn".param_types[1].?;
        }

        const Methods = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getMethodName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var field_names: [count][:0]const u8 = undefined;
            var field_types: [count]type = undefined;
            var field_attrs: [count]std.lang.Type.Struct.FieldAttributes = undefined;
            for (decl_names) |decl_name| {
                if (getMethodName(decl_name)) |name| {
                    field_names[i] = name;
                    field_types[i] = Function;
                    field_attrs[i] = .{};
                    i += 1;
                }
            }
            break :init @Struct(.auto, null, &field_names, &field_types, &field_attrs);
        };
        const methods: Methods = init: {
            const st = @typeInfo(Methods).@"struct";
            var m: Methods = undefined;
            for (st.field_names) |name| {
                const func = @field(T, name);
                @field(m, name) = Function.fromHandler(func, .{ .this = T });
            }
            break :init m;
        };
        const getter_names = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getGetterName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var names: [count][:0]const u8 = undefined;
            for (decl_names) |decl_name| {
                if (getGetterName(decl_name)) |name| {
                    names[i] = name;
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
                if (getSetterName(decl_name)) |name| {
                    names[i] = name;
                    i += 1;
                }
            }
            break :init names;
        };
        var handlers: Object.Handlers = undefined;
        var class: *Class = undefined;

        custom: T align(@max(@alignOf(T), @alignOf(Object))),
        object: Object,

        comptime {
            if (@offsetOf(@This(), "custom") != 0) {
                @compileError("custom is in the wrong position");
            }
        }
    };
}
