// add-error.zig
pub const MathError = error{
    UnexpectedSpanishInquisition,
    RecordIsScratched,
};

pub fn add(a: i32, b: i32) !i32 {
    if (a == 0 or b == 0) {
        return MathError.UnexpectedSpanishInquisition;
    }
    return a + b;
}
