const std = @import("std");
const c = @cImport({
    @cInclude("stdio.h");
});

const enum_fn = if (@hasField(std.builtin.Type, "Fn")) .Fn else .@"fn";

pub fn stream(num: i32) ?*c.FILE {
    if (comptime @hasDecl(c, "__acrt_iob_func")) {
        return c.__acrt_iob_func(@intCast(num));
    } else {
        const names = .{ "stdin", "stdout", "stderr" };
        return inline for (names, 0..) |name, index| {
            if (num == index) {
                // on the Mac we get a function returning the stream instead of the stream
                const s = @field(c, name);
                return if (@typeInfo(@TypeOf(s)) == enum_fn) s() else s;
            }
        } else null;
    }
}

pub const fwrite = c.fwrite;
pub const fopen = c.fopen;
pub const fclose = c.fclose;
pub const fprintf = c.fprintf;
pub const puts = c.puts;
