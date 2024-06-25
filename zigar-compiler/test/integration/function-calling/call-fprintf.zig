const c = @cImport({
    @cInclude("stdio.h");
});

pub fn stream(num: i32) ?*c.FILE {
    if (comptime @hasDecl(c, "__acrt_iob_func")) {
        return c.__acrt_iob_func(@intCast(num));
    } else {
        return switch (num) {
            0 => c.stdin,
            1 => c.stdout,
            2 => c.stderr,
            else => null,
        };
    }
}
pub const fprintf = c.fprintf;
pub const fopen = c.fopen;
pub const fclose = c.fclose;

pub const Int = i32;
pub const Double = f64;
pub const Float = f32;
pub const StrPtr = [*:0]u8;
