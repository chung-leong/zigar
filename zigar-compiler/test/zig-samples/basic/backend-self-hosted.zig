const builtin = @import("builtin");

comptime {
    if (builtin.zig_backend != .stage2_x86_64) @compileError("Wrong backend");
}
