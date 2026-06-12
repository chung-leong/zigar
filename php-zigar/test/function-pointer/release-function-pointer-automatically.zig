pub fn call(cb: *const fn () void) void {
    cb();
}
