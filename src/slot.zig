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

// allocate slots for classe, function, and other language constructs on the host side
const structure_slot = allocator.get(.{});

pub fn getStructureSlot(comptime S: anytype) u32 {
    return structure_slot.get(S);
}

pub fn getRelocatableSlot(comptime T: anytype, field_name: []const u8) u32 {
    // per-struct slot allocator
    const relocatable_slot = allocator.get(.{ .Struct = T });
    return relocatable_slot.get(.{ .Field = field_name });
}
