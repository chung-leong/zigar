const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};

pub fn getInteger() Variant {
    return .{ .integer = 300 };
}

pub fn getFloat() Variant {
    return .{ .float = 3.14 };
}

pub fn getString() Variant {
    return .{ .string = "Hello" };
}
