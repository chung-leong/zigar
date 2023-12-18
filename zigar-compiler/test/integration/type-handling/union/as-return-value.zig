const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};

pub fn getInteger() Variant {
    return .{ .Integer = 300 };
}

pub fn getFloat() Variant {
    return .{ .Float = 3.14 };
}

pub fn getString() Variant {
    return .{ .String = "Hello" };
}
