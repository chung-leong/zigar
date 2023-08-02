const string = @cImport(
    @cInclude("string.h"),
);

pub fn getLength(s: []const u8) usize {
    return string.strlen(s.ptr);
}
