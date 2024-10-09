pub fn getNamespace(comptime HostT: type) type {
    _ = HostT;
    return struct {
        pub fn release(fn_ptr: *const anyopaque) void {}

        pub fn multithread(enabled: bool) void {}
    };
}
