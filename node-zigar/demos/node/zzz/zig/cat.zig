const std = @import("std");

pub fn handleCat(allocator: std.mem.Allocator, _: []const u8) error{Unexpected}![]u8 {
    const html =
        \\ <!DOCTYPE html>
        \\ <html>
        \\ <body>
        \\ <h1>Meow!</h1>
        \\ </body>
        \\ </html>
    ;
    return allocator.dupe(u8, html) catch error.Unexpected;
}
