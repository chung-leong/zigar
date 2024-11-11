const zigar = @import("zigar");

pub const Callback = fn () void;

pub fn foo(_: *const Callback) void {}

pub fn release(f: *const Callback) void {
    zigar.function.release(f);
}
