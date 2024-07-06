const c = @cImport({
    @cInclude("stdio.h");
});

pub fn stream(num: i32) ?*c.FILE {
    if (comptime @hasDecl(c, "__acrt_iob_func")) {
        return c.__acrt_iob_func(@intCast(num));
    } else {
        const s = switch (num) {
            0 => c.stdin,
            1 => c.stdout,
            2 => c.stderr,
            else => null,
        };
        return switch (@typeInfo(@TypeOf(s))) {
            .Fn => s(),
            else => s,
        };
    }
}

pub const fwrite = c.fwrite;
pub const fopen = c.fopen;
pub const fclose = c.fclose;
pub const fprintf = c.fprintf;
pub const puts = c.puts;
