pub const u8_slice: [*:0]const u8 = "Hello world";
const i64_array: [10]i64 = .{ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
pub const i64_slice: [*:7]const i64 = @ptrCast(&i64_array);

// ensure generation of WASM code
pub fn something() void {}
