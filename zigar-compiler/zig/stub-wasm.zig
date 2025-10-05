const std = @import("std");

const module = @import("module");

pub const host = @import("./host-wasm.zig");

export fn getFactoryThunk() usize {
    return host.getFactoryThunk(module);
}

pub fn panic(msg: []const u8, error_return_trace: ?*std.builtin.StackTrace, ret_addr: ?usize) noreturn {
    host.panic(msg, error_return_trace, ret_addr);
}

pub const std_options: std.Options = if (@hasDecl(module, "std_options")) module.std_options else .{};
