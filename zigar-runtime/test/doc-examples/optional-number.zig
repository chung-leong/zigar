// optional-number.zig
pub fn getNumber(really: bool) ?i32 {
    if (!really) {
        return null;
    }
    return 43;
}
