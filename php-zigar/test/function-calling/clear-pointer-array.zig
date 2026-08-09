pub const OptionalStrings = ?[2][]const u8;

pub fn setOptionalNull(ptr: *OptionalStrings) void {
    ptr.* = null;
}
