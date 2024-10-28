pub const Fn = fn () void;

pub fn call(ptr: *const Fn) void {
    ptr();
}
