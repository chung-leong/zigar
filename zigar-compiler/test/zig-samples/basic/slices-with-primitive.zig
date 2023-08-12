pub const int32_array: [3]i32 = .{ 123, 456, 789 };
pub const int32_slice: []const i32 = &int32_array;
pub const u8_slice: []const u8 = "Hello world";

pub var uint32_array4: [4]u32 = .{ 1, 2, 3, 4 };
pub var uint32_slice = uint32_array4[1..4];

// ensure generation of WASM code
pub fn something() void {}
