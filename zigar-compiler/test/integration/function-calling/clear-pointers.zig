const ValueType = enum { string, Number };
const Error = error{ bad_thing1, bad_thign2 };

pub const OptionalString = ?[]const u8;
pub const ErrorOrString = Error![]const u8;
pub const StringOrNumber = union(ValueType) {
    string: []const u8,
    Number: i32,
};

pub fn setOptionalNull(ptr: *OptionalString) void {
    ptr.* = null;
}

pub fn setErrorUnion(ptr: *ErrorOrString) void {
    ptr.* = Error.bad_thing1;
}

pub fn setUnionNumber(ptr: *StringOrNumber) void {
    ptr.* = .{ .Number = 123 };
}
