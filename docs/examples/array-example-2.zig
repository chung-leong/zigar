pub fn get4(offset: i32) [4]i32 {
    var values: [4]i32 = undefined;
    for (&values, 0..) |*value_ptr, index| {
        value_ptr.* = @as(i32, @intCast(index)) + offset;
    }
    return values;
}
