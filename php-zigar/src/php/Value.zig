const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const pi = php.imports;
const Callable = php.Callable;
const Dictionary = php.Dictionary;
const Object = php.Object;
const Reference = php.Reference;
const Resource = php.Resource;
const Stream = php.Stream;
const String = php.String;
const unsupported = php.failure.unsupported;
const Array = php.Array;

pub fn kind(self: *const @This()) Kind {
    return switch (self.impl.u1.v.type) {
        c.IS_TRUE => .boolean,
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
    return self.impl.u1.v.type == c.IS_TRUE;
}

pub fn integer(self: *const @This()) c_long {
    return self.impl.value.lval;
}

pub fn float(self: *const @This()) f64 {
    return self.impl.value.dval;
}

pub fn string(self: *const @This()) *String {
    return @ptrCast(self.impl.value.str);
}

pub fn array(self: *const @This()) *Array {
    return @ptrCast(self.impl.value.arr);
}

pub fn object(self: *const @This()) *Object {
    return @ptrCast(self.impl.value.obj);
}

pub fn resource(self: *const @This()) *Resource {
    return @ptrCast(self.impl.value.res);
}

pub fn reference(self: *const @This()) *Reference {
    return @ptrCast(self.impl.value.ref);
}

pub fn pointer(self: *const @This()) *anyopaque {
    return @ptrCast(self.impl.value.ptr);
}

pub fn retain(self: *const @This()) @This() {
    self.addRef();
    return self.*;
}

pub fn addRef(self: *const @This()) void {
    const zval = &self.impl;
    // persistent value
    if (zval.u1.type_info & c.Z_TYPE_FLAGS_MASK == 0) return;
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
    if (zval.u1.type_info & c.Z_TYPE_FLAGS_MASK == 0) return;
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

pub fn getReference(self: *const @This()) !*Reference {
    return switch (self.kind()) {
        .reference => self.resource(),
        else => error.NotReference,
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

pub fn getPointer(self: *const @This()) !*anyopaque {
    return switch (self.kind()) {
        .pointer => self.pointer(),
        else => error.NotPointer,
    };
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
    if (T == @This()) return self.*;
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
        .optional => |opt| if (self.isNull()) null else try self.convertTo(opt.child),
        .@"struct" => switch (T) {
            Callable => try self.getCallable(),
            // TODO: handle packed struct
            else => unsupported(T),
        },
        .@"union" => |un| switch (T) {
            Dictionary => try self.getDictionary(),
            else => inline for (un.field_types, 0..) |FT, i| {
                if (self.convertTo(FT)) |nv| break @unionInit(T, un.field_names[i], nv) else |_| {}
            } else error.NoMatch,
        },

        else => unsupported(T),
    };
}

pub fn toZval(self: *const @This()) c.zval {
    return @as(*const c.zval, @ptrCast(&self)).*;
}

pub fn fromZval(val: c.zval) @This() {
    return @as(*const @This(), @ptrCast(&val)).*;
}

pub fn fromNull() @This() {
    return .{
        .impl = .{ .u1 = .{ .type_info = c.IS_NULL } },
    };
}

pub fn fromBool(b: bool) @This() {
    return .{
        .impl = .{ .u1 = .{ .type_info = if (b) c.IS_TRUE else c.IS_FALSE } },
    };
}

pub fn fromInteger(lval: c_long) @This() {
    return .{
        .impl = .{
            .u1 = .{ .type_info = c.IS_LONG },
            .value = .{ .lval = lval },
        },
    };
}

pub fn fromUnsigned(ul: c_ulong) @This() {
    return fromInteger(@intCast(ul));
}

pub fn fromFloat(dval: f64) @This() {
    return .{
        .impl = .{
            .u1 = .{ .type_info = c.IS_DOUBLE },
            .value = .{ .dval = dval },
        },
    };
}

pub fn fromString(str: *const String) @This() {
    return .{
        .impl = .{
            .u1 = .{
                .type_info = switch (str.isInterned()) {
                    false => c.IS_STRING_EX, // with gc flag
                    true => c.IS_STRING,
                },
            },
            .value = .{ .str = @ptrCast(@constCast(str)) },
        },
    };
}

pub fn fromArray(arr: *const Array) @This() {
    return .{
        .impl = .{
            .u1 = .{ .type_info = c.IS_ARRAY_EX },
            .value = .{ .arr = @ptrCast(@constCast(arr)) },
        },
    };
}

pub fn fromObject(obj: *const Object) @This() {
    return .{
        .impl = .{
            .u1 = .{ .type_info = c.IS_OBJECT_EX },
            .value = .{ .obj = @ptrCast(@constCast(obj)) },
        },
    };
}

pub fn fromResource(res: *const Resource) @This() {
    return .{
        .impl = .{
            .u1 = .{ .type_info = c.IS_RESOURCE },
            .value = .{ .res = @ptrCast(@constCast(res)) },
        },
    };
}

pub fn fromStream(strm: *const Stream) @This() {
    return strm.toValue();
}

pub fn fromReference(ref: *const Reference) @This() {
    return .{
        .impl = .{
            .u1 = .{ .type_info = c.IS_REFERENCE_EX },
            .value = .{ .ref = @ptrCast(@constCast(ref)) },
        },
    };
}

pub fn fromPointer(ptr: *const anyopaque) @This() {
    return .{
        .impl = .{
            .u1 = .{ .type_info = c.IS_PTR },
            .value = .{ .ptr = @constCast(ptr) },
        },
    };
}

pub fn fromAny(arg: anytype) @This() {
    const T = @TypeOf(arg);
    if (T == @This()) return arg;
    return switch (@typeInfo(T)) {
        .void => .fromNull(),
        .bool => .fromBool(arg),
        .int => |int| switch (int.signedness) {
            .signed => .fromInteger(arg),
            .unsigned => .fromUnsigned(arg),
        },
        .float => .fromFloat(arg),
        .@"enum" => .fromEnum(arg),
        .pointer => |pt| switch (pt.size) {
            .one => switch (pt.child) {
                String => .fromString(arg),
                Array => .fromArray(arg),
                Object => .fromObject(arg),
                Resource => .fromResource(arg),
                Stream => .fromStream(arg),
                Reference => .fromReference(arg),
                else => unsupported(T),
            },
            .slice => switch (pt.child) {
                u8 => .fromString(.create(arg)),
                else => unsupported(T),
            },
            else => unsupported(T),
        },
        .@"struct" => |st| if (st.backing_integer) |BT|
            @as(BT, @bitCast(arg))
        else
            unsupported(T),
        .@"union" => |un| if (un.tag_type) |Tag|
            inline for (un.field_names) |name| {
                if (arg == @field(Tag, name)) break .fromAny(@field(arg, name));
            } else unsupported(T)
        else
            unsupported(T),
        else => unsupported(T),
    };
}

pub const Kind = enum(u8) {
    undefined = c.IS_UNDEF, // 0
    null = c.IS_NULL, // 1
    boolean = c.IS_FALSE, // 2
    integer = c.IS_LONG, // 4
    float = c.IS_DOUBLE, // 5
    string = c.IS_STRING, // 6
    array = c.IS_ARRAY, // 7
    object = c.IS_OBJECT, // 8
    resource = c.IS_RESOURCE, // 9
    reference = c.IS_REFERENCE, // 10
    constant_ast = c.IS_CONSTANT_AST, // 11
    callable = c.IS_CALLABLE, // 12
    pointer = c.IS_PTR, // 13
    _,

    pub fn name(self: @This()) []const u8 {
        return switch (self) {
            .integer => "int",
            else => @tagName(self),
        };
    }
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

impl: c.zval,
