const c = @cImport({
    @cInclude("stdio.h");
});

pub fn stream(num: i32) ?[*c]c.FILE {
    return switch (num) {
        0 => c.stdin,
        1 => c.stdout,
        2 => c.stderr,
        else => null,
    };
}

pub const fopen = c.fopen;
pub const fclose = c.fclose;
pub const fprintf = c.fprintf;
pub const printf = c.printf;

pub const Int = c_int;
