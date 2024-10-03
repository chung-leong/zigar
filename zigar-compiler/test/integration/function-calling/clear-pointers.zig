const ValueType = enum { string, Number };
const Error = error{ BadThing1, BadThing2 };

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
    ptr.* = Error.BadThing1;
}

pub fn setUnionNumber(ptr: *StringOrNumber) void {
    ptr.* = .{ .Number = 123 };
}
