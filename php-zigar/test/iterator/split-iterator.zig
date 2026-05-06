const std = @import("std");

pub fn split(text: []const u8, delimiter: []const u8) std.mem.SplitIterator(u8, .sequence) {
    return std.mem.splitSequence(u8, text, delimiter);
}
