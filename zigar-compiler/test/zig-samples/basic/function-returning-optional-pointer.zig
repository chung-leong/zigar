const text: []const u8 = "Hello world";

pub fn getSentence(index: u32) ?[]const u8 {
    return if (index == 0) text else null;
}
