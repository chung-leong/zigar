pub const int32_slice: []const i32 = &[3]i32{ 123, 456, 789 };
pub const u8_slice: []const u8 = "Hello world";

pub var uint32_array4: [4]u32 = .{ 1, 2, 3, 4 };
pub var uint32_slice = uint32_array4[1..4];
