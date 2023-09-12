const ValueType = enum { String, Number };
const Error = error{ BadThing1, BadThign2 };

pub const OptionalString = ?[]const u8;
pub const ErrorOrString = Error![]const u8;
pub const StringOrNumber = union(ValueType) {
    String: []const u8,
    Number: i32,
};

pub fn setOptionalNull(ptr: *OptionalString) void {
    ptr.* = null;
}

pub fn setErrorUnion(ptr: *ErrorOrString) void {
    ptr.* = Error.BadThing1;
}

pub fn setUnionNumber(ptr: *StringOrNumber) void {
    ptr.* = .{ .Number = 123 };
}
