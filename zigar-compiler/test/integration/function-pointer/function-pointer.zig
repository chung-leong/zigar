pub const Callback = fn () void;

pub fn foo(_: *const Callback) void {}
