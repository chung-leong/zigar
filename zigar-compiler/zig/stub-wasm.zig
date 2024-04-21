const std = @import("std");
const exporter = @import("exporter");

const Value = exporter.Value;
const Call = exporter.Call;

export fn allocateExternMemory(len: usize, alignment: u16) ?[*]u8 {
    return exporter.allocateExternMemory(len, alignment);
}

export fn freeExternMemory(bytes: [*]u8, len: usize, alignment: u16) void {
    exporter.freeExternMemory(bytes, len, alignment);
}

export fn allocateShadowMemory(call: Call, len: usize, alignment: u16) ?Value {
    return exporter.allocateShadowMemory(call, len, alignment);
}

export fn freeShadowMemory(call: Call, bytes: [*]u8, len: usize, alignment: u16) void {
    exporter.freeShadowMemory(call, bytes, len, alignment);
}

export fn getFactoryThunk() usize {
    return exporter.getFactoryThunk(@import("module"));
}

export fn runThunk(thunk_id: usize, arg_struct: Value) ?Value {
    return exporter.runThunk(thunk_id, arg_struct);
}

export fn isRuntimeSafetyActive() bool {
    return exporter.isRuntimeSafetyActive();
}

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    std.debug.print("{s}\n", .{msg});
    return std.process.abort();
}
