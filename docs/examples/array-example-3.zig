const std = @import("std");

const hello = "Привіт";

pub fn getHello8() [hello.len]u8 {
    var bytes: [hello.len]u8 = undefined;
    for (&bytes, 0..) |*byte_ptr, index| {
        byte_ptr.* = hello[index];
    }
    return bytes;
}

pub fn getHello16() [hello.len / 2]u16 {
    var codepoints: [hello.len / 2]u16 = undefined;
    var view = std.unicode.Utf8View.initUnchecked(hello);
    var iterator = view.iterator();
    for (&codepoints) |*codepoint_ptr| {
        if (iterator.nextCodepoint()) |cp| {
            codepoint_ptr.* = @truncate(cp);
        }
    }
    return codepoints;
}
