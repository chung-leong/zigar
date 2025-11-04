pub const AbortSignal = struct {
    ptr: *const volatile i32,

    pub const internal_type = .abort_signal;

    pub inline fn on(self: @This()) bool {
        return self.ptr.* != 0;
    }

    pub inline fn off(self: @This()) bool {
        return self.ptr.* == 0;
    }
};
