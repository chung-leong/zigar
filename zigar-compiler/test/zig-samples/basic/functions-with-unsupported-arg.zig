pub fn needFn(cb: *const fn () void) void {
    cb();
}

pub fn needOptionalFn(cb: ?*const fn () void) void {
    if (cb) |f| {
        f();
    }
}

// pub fn needFrame(f: anyframe) void {
//     _ = f;
//     unreachable;
// }

pub fn nothing() void {}
