const std = @import("std");
const host = @import("./host-wasm.zig");

export fn getFactoryThunk() usize {
    return host.getFactoryThunk(@import("module"));
}

pub fn panic(msg: []const u8, error_return_trace: ?*std.builtin.StackTrace, ret_addr: ?usize) noreturn {
    host.panic(msg, error_return_trace, ret_addr);
}
