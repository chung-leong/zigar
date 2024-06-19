const c = @cImport({
    @cInclude("stdio.h");
});

pub const fwrite = c.fwrite;
pub const puts = c.puts;

pub fn print(data: *anyopaque, len: usize) void {
    _ = fwrite(data, 1, len, c.stdout);
}
