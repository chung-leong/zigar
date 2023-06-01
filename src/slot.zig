pub const allocator = struct {
    fn get(comptime S1: anytype) type {
        _ = S1;
        // results of comptime functions are memoized
        // that means the same S1 will yield the same counter
        return blk: {
            comptime var next = 1;
            const counter = struct {
                // same principle here; the same S2 will
                // yield the same number, established by the
                // first call
                fn get(comptime S2: anytype) comptime_int {
                    _ = S2;
                    const slot = next;
                    next += 1;
                    return slot;
                }
            };
            break :blk counter;
        };
    }
};
