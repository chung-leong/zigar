const std = @import("std");

const stdio = @cImport({
    @cInclude("stdio.h");
});

pub fn push(c: c_int) void {
    const stdin = switch (@typeInfo(@TypeOf(stdio.stdin))) {
        .@"fn" => stdio.stdin(),
        else => stdio.stdin,
    };
    _ = stdio.ungetc(c, stdin);
}

pub fn get() c_int {
    return stdio.getchar();
}
