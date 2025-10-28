const std = @import("std");

const module = @import("module");

pub const host = @import("./host-wasm.zig");

export fn getFactoryThunk() usize {
    return host.getFactoryThunk(module);
}

pub const std_options: std.Options = if (@hasDecl(module, "std_options")) module.std_options else .{};

pub const panic = switch (@hasDecl(module, "panic") and @TypeOf(module.panic) == type) {
    true => module.panic,
    false => panicFn,
};

fn panicFn(msg: []const u8, error_return_trace: ?*std.builtin.StackTrace, ret_addr: ?usize) noreturn {
    if (@hasDecl(module, "panic"))
        module.panic(msg, error_return_trace, ret_addr)
    else
        host.panic(msg, error_return_trace, ret_addr);
}
