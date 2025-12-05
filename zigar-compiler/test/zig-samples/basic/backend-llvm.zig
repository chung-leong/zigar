const builtin = @import("builtin");

comptime {
    if (builtin.zig_backend != .stage2_llvm) @compileError("Wrong backend");
}
