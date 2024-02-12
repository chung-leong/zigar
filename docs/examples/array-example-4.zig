pub fn get4Big(offset: i64) [4]i64 {
    var values: [4]i64 = undefined;
    for (&values, 0..) |*value_ptr, index| {
        value_ptr.* = @as(i64, @intCast(index)) + offset;
    }
    return values;
}
