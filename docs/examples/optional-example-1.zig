pub fn findIndex(haystack: []const u8, needle: [1]u8) ?usize {
    var index: usize = 0;
    while (index < haystack.len) : (index += 1) {
        if (haystack[index] == needle[0]) {
            return index;
        }
    }
    return null;
}
