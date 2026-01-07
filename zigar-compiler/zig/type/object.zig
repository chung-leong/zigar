pub fn is(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .@"struct", .@"union", .array, .error_union, .optional, .pointer, .vector, .@"fn" => true,
        else => false,
    };
}
