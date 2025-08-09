const std = @import("std");

const stdio = @cImport({
    @cInclude("stdio.h");
});

pub fn push(c: c_int) void {
    _ = stdio.ungetc(c, stdio.stdin);
}

pub fn get() c_int {
    return stdio.getchar();
}
