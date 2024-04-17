const std = @import("std");

pub const Header = struct {
    comptime size: u32 = @sizeOf(@This()),
    id: u32,
    flags: u32,
    offset: u64,
};

pub fn main() void {
    var header: Header = undefined;
    header.id = 123;
    header.flags = 0xFF;
    header.offset = 0x1000000;
    std.debug.print("Size: {d}\n", .{header.size});
    std.debug.print("{any}\n", .{header});
}
