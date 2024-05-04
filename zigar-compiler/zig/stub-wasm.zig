const std = @import("std");
const host = @import("./host-wasm.zig");

const Value = host.Value;
const Call = host.Call;

export fn allocateExternMemory(len: usize, alignment: u16) ?[*]u8 {
    return host.allocateExternMemory(len, alignment);
}

export fn freeExternMemory(bytes: [*]u8, len: usize, alignment: u16) void {
    host.freeExternMemory(bytes, len, alignment);
}

export fn allocateShadowMemory(call: Call, len: usize, alignment: u16) ?Value {
    return host.allocateShadowMemory(call, len, alignment);
}

export fn freeShadowMemory(call: Call, bytes: [*]u8, len: usize, alignment: u16) void {
    host.freeShadowMemory(call, bytes, len, alignment);
}

export fn getFactoryThunk() usize {
    return host.getFactoryThunk(@import("module"));
}

export fn runThunk(thunk_id: usize, arg_struct: Value) ?Value {
    return host.runThunk(thunk_id, arg_struct);
}

export fn isRuntimeSafetyActive() bool {
    return host.isRuntimeSafetyActive();
}

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    std.debug.print("{s}\n", .{msg});
    return std.process.abort();
}
