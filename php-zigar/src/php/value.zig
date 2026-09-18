const std = @import("std");

const Array = @import("array.zig").Array;
const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const castTo = c.castTo;
const castFrom = c.castFrom;
const Callable = @import("callable.zig").Callable;
const Dictionary = @import("dictionary.zig").Dictionary;
const Object = @import("object.zig").Object;
const Resource = @import("resource.zig").Resource;
const Stream = @import("stream.zig").Stream;
const String = @import("string.zig").String;
const unsupported = @import("failure.zig").unsupported;

pub const Value = struct {
    pub fn kind(self: *const @This()) Kind {
        return switch (self.impl.u1.v.type) {
            pd.IS_TRUE => .boolean,
            else => @enumFromInt(self.impl.u1.v.type),
        };
    }

    pub fn isNull(self: *const @This()) bool {
        return self.kind() == .null;
    }

    pub fn isCallable(self: *const @This()) bool {
        const zval = @constCast(&self.impl);
        return pi.zend_is_callable_ex(zval, null, 0, null, null, null);
    }

    pub fn boolean(self: *const @This()) bool {
        return self.impl.u1.v.type == pd.IS_TRUE;
    }

    pub fn integer(self: *const @This()) c_long {
        return self.impl.value.lval;
    }

    pub fn float(self: *const @This()) f64 {
        return self.impl.value.dval;
    }

    pub fn string(self: *const @This()) *String {
        return castTo(String, self.impl.value.str);
    }

    pub fn array(self: *const @This()) *Array {
        return castTo(Array, self.impl.value.arr);
    }

    pub fn object(self: *const @This()) *Object {
        return castTo(Object, self.impl.value.obj);
    }

    pub fn resource(self: *const @This()) *Resource {
        return castTo(Resource, self.impl.value.res);
    }

    pub fn reuse(self: *const @This()) @This() {
        self.addRef();
        return self.*;
    }

    pub fn addRef(self: *const @This()) void {
        const zval = &self.impl;
        // persistent value
        if (zval.u1.type_info & pd.Z_TYPE_FLAGS_MASK == 0) return;
        switch (self.kind()) {
            .string => self.string().addRef(),
            .array => self.array().addRef(),
            .object => self.object().addRef(),
            .resource => self.resource().addRef(),
            else => {},
        }
    }

    pub fn release(self: *const @This()) void {
        const zval = &self.impl;
        // persistent value
        if (zval.u1.type_info & pd.Z_TYPE_FLAGS_MASK == 0) return;
        switch (self.kind()) {
            .string => self.string().release(),
            .array => self.array().release(),
            .object => self.object().release(),
            .resource => self.resource().release(),
            else => {},
        }
    }

    pub fn subtractRef(self: *@This()) void {
        const zval = &self.impl;
        // persistent value
        if (zval.u1.type_info & c.Z_TYPE_FLAGS_MASK == 0) return;
        switch (self.kind()) {
            .string => self.string().subtractRef(),
            .array => self.array().subtractRef(),
            .object => self.object().subtractRef(),
            .resource => self.resource().subtractRef(),
            else => {},
        }
    }

    pub fn getBoolean(self: *const @This()) !bool {
        return switch (self.kind()) {
            .boolean => self.boolean(),
            else => error.NotBoolean,
        };
    }

    pub fn getInteger(self: *const @This()) !c_long {
        return switch (self.kind()) {
            .integer => self.integer(),
            .float => try floatToInteger(self.float()),
            .string => switch (try self.string().toNumeric()) {
                .integer => |i| i,
                .float => |f| try floatToInteger(f),
            },
            else => error.NotInteger,
        };
    }

    pub fn getUnsigned(self: *const @This()) !c_ulong {
        const i = try self.getInteger();
        return if (i >= 0) @intCast(i) else error.NegativeValue;
    }

    pub fn getFloat(self: *const @This()) !f64 {
        return switch (self.kind()) {
            .float => self.float(),
            .integer => try integerToFloat(self.integer()),
            .string => switch (self.string().toNumeric()) {
                .integer => |i| try integerToFloat(i),
                .float => |f| f,
            },
            else => error.NotFloatingPointNumber,
        };
    }

    pub fn getString(self: *const @This()) !*String {
        return switch (self.kind()) {
            .string => self.string(),
            else => error.NotString,
        };
    }

    pub fn getArray(self: *const @This()) !*Array {
        return switch (self.kind()) {
            .array => self.array(),
            else => error.NotArray,
        };
    }

    pub fn getObject(self: *const @This()) !*Object {
        return switch (self.kind()) {
            .object => self.object(),
            else => error.NotObject,
        };
    }

    pub fn getResource(self: *const @This()) !*Resource {
        return switch (self.kind()) {
            .resource => self.resource(),
            else => error.NotResource,
        };
    }

    pub fn getStream(self: *const @This()) !*Stream {
        if (self.kind() == .resource) {
            const zres_ptr = pi.zend_fetch_resource2_ex(
                @constCast(&self.impl),
                "stream",
                pi.php_file_le_stream(),
                pi.php_file_le_pstream(),
            );
            if (zres_ptr) |ptr| return @ptrCast(@alignCast(ptr));
        }
        return error.NotStream;
    }

    pub fn getDictionary(self: *const @This()) !Dictionary {
        return switch (self.kind()) {
            .array => get: {
                const arr = self.array();
                if (!arr.isAssociative()) return error.NotAssociativeArray;
                break :get .{ .array = arr };
            },
            .object => .{ .object = self.object() },
            else => error.NotArrayOrObject,
        };
    }

    pub fn getCallable(self: *const @This()) !Callable {
        if (!self.isCallable()) return error.NotCallable;
        return .{ .value = self.* };
    }

    pub fn stringify(self: *const @This()) !*String {
        var copy = self.*;
        pi._convert_to_string(&copy.impl);
        return copy.string();
    }

    pub fn convertTo(self: *const @This(), comptime T: type) !T {
        return switch (@typeInfo(T)) {
            .bool => try self.getBoolean(),
            .int => |int| get: {
                const int_value = switch (int.signedness) {
                    .signed => try self.getInteger(),
                    .unsigned => try self.getUnsigned(),
                };
                if (int_value > std.math.maxInt(T) or int_value < std.math.minInt(T)) return error.OutOfBound;
                break :get @intCast(int_value);
            },
            .float => get: {
                const float_value = self.getFloat();
                break :get @floatCast(float_value);
            },
            .pointer => |pt| switch (pt.size) {
                .one => switch (pt.child) {
                    String => try self.getString(),
                    Array => try self.getArray(),
                    Object => try self.getObject(),
                    Resource => try self.getResource(),
                    else => unsupported(T),
                },
                .slice => switch (pt.child) {
                    u8 => (try self.getString()).slice(),
                    else => unsupported(T),
                },
                else => unsupported(T),
            },
            .optional => |opt| if (self.isNull()) null else try self.convertValue(opt.child),
            .@"struct" => switch (T) {
                Callable => try self.getCallable(),
                // TODO: handle packed struct
                else => unsupported(T),
            },
            .@"union" => |un| switch (T) {
                Dictionary => try self.getDictionary(),
                else => inline for (un.field_types, 0..) |FT, i| {
                    if (self.convertTo(FT)) |nv| break @unionInit(T, un.field_names[i], nv) else |_| {}
                },
            },

            else => unsupported(T),
        };
    }

    pub fn fromNull() @This() {
        return .{
            .impl = .{ .u1 = .{ .type_info = pd.IS_NULL } },
        };
    }

    pub fn fromBool(b: bool) @This() {
        return .{
            .impl = .{ .u1 = .{ .type_info = if (b) pd.IS_TRUE else pd.IS_FALSE } },
        };
    }

    pub fn fromInteger(l: c_long) @This() {
        return .{
            .impl = .{
                .u1 = .{ .type_info = pd.IS_LONG },
                .value = .{ .lval = l },
            },
        };
    }

    pub fn fromUnsigned(ul: c_ulong) @This() {
        return fromInteger(@intCast(ul));
    }

    pub fn fromFloat(d: f64) @This() {
        return .{
            .impl = .{
                .u1 = .{ .type_info = pd.IS_DOUBLE },
                .value = .{ .dval = d },
            },
        };
    }

    pub fn fromString(s: *const String) @This() {
        return .{
            .impl = .{
                .u1 = .{
                    .type_info = switch (s.isInterned()) {
                        false => pd.IS_STRING_EX, // with gc flag
                        true => pd.IS_STRING,
                    },
                },
                .value = .{ .str = @constCast(castFrom(String, s)) },
            },
        };
    }

    pub fn fromArray(a: *const Array) @This() {
        return .{
            .impl = .{
                .u1 = .{ .type_info = pd.IS_ARRAY_EX },
                .value = .{ .arr = @constCast(castFrom(Array, a)) },
            },
        };
    }

    pub fn fromObject(o: *const Object) @This() {
        return .{
            .impl = .{
                .u1 = .{ .type_info = pd.IS_OBJECT_EX },
                .value = .{ .obj = @constCast(castFrom(Object, o)) },
            },
        };
    }

    pub fn fromResource(r: *const Resource) @This() {
        return .{
            .impl = .{
                .u1 = .{ .type_info = pd.IS_RESOURCE },
                .value = .{ .res = @constCast(castFrom(Resource, r)) },
            },
        };
    }

    pub fn fromStream(s: *const Stream) @This() {
        return s.toValue();
    }

    pub const Kind = enum(u8) {
        undefined = pd.IS_UNDEF, // 0
        null = pd.IS_NULL, // 1
        boolean = pd.IS_FALSE, // 2
        integer = pd.IS_LONG, // 4
        float = pd.IS_DOUBLE, // 5
        string = pd.IS_STRING, // 6
        array = pd.IS_ARRAY, // 7
        object = pd.IS_OBJECT, // 8
        resource = pd.IS_RESOURCE, // 9
        reference = pd.IS_REFERENCE, // 10
        constant_ast = pd.IS_CONSTANT_AST, // 11
        callable = pd.IS_CALLABLE, // 12
        pointer = pd.IS_PTR, // 13
        _,

        pub fn name(self: @This()) []const u8 {
            return switch (self) {
                .integer => "int",
                else => @tagName(self),
            };
        }
    };

    impl: pd.zval,
};

fn floatToInteger(value: f64) !c_long {
    @setRuntimeSafety(false);
    const long: c_long = @intFromFloat(value);
    const double: f64 = @floatFromInt(long);
    return switch (double == value) {
        true => long,
        else => error.NotInteger,
    };
}

fn integerToFloat(value: c_long) !f64 {
    @setRuntimeSafety(false);
    const double: f64 = @floatFromInt(value);
    const long: c_long = @intFromFloat(double);
    return switch (long == value) {
        true => double,
        else => error.NotFloatingPoint,
    };
}
