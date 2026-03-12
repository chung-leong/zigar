const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("sys/stat.h");
});

pub fn makeDirectory(path: [*:0]const u8) !void {
    const param_count = @typeInfo(@TypeOf(c.mkdir)).@"fn".params.len;
    const result = if (param_count == 1) c.mkdir(path) else c.mkdir(path, 0o777);
    if (result < 0) return error.UnableToCreateDirectory;
}
