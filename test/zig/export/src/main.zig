const std = @import("std");
const assert = std.debug.assert;
const exporter = @import("exporter");

export const zig_module = exporter.createModule(@import("./module.zig"));

fn strcmp(s1: [*]const u8, s2: [*]const u8) i32 {
    var i: usize = 0;
    while (s1[i] != 0 and s2[i] != 0) : (i += 1) {
        if (s1[i] < s2[i]) {
            return -1;
        } else if (s1[i] > s2[i]) {
            return 1;
        }
    }
    return 0;
}

test "version number" {
    assert(zig_module.version == exporter.api_version);
}
