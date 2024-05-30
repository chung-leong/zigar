const c = @cImport({
    @cInclude("cowsay.c");
});

pub fn cowsay(args: [][*:0]const u8) void {
    _ = c.main(@intCast(args.len), @ptrCast(args));
}
