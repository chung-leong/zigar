pub fn memset(comptime T: type, slice: []T, value: T) void {
    @memset(slice, value);
}

pub fn nothing() void {}
