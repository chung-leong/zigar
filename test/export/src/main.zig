const std = @import("std");
const assert = std.debug.assert;
const exporter = @import("exporter");

export const zig_module = exporter.createModule(@import("./module.zig"));

test "version number" {
    assert(zig_module.version == exporter.api_version);
}
