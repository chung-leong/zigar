export fn run(address: usize) void {
    const f: *const fn () void = @ptrFromInt(address);
    f();
}
