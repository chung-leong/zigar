const zigar = @import("zigar");

const CallbackFn = fn ([]const u8) void;

pub fn call(f: *const CallbackFn) void {
    defer zigar.function.release(f);
    f("Hello world");
}

pub const @"meta(zigar)" = struct {
    pub fn isArgumentString(comptime FT: type, comptime _: usize) bool {
        return FT == CallbackFn;
    }
};
