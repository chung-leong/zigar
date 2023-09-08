fn createSetFn(comptime T: type) fn ([]T, T) void {
    const S = struct {
        fn set(slice: []T, value: T) void {
            @memset(slice, value);
        }
    };
    return S.set;
}

pub const setU8 = createSetFn(u8);
pub const setI8 = createSetFn(i8);
pub const setU16 = createSetFn(u16);
pub const setI16 = createSetFn(i16);
pub const setU32 = createSetFn(u32);
pub const setI32 = createSetFn(i32);
pub const setU64 = createSetFn(u64);
pub const setI64 = createSetFn(i64);
pub const setF32 = createSetFn(f32);
pub const setF64 = createSetFn(f64);
