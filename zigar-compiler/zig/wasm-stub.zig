const std = @import("std");
const exporter = @import("exporter");
const package = @import("package");

const Value = exporter.Value;
const Thunk = exporter.Thunk;
const Call = exporter.Call;

pub const os = exporter.getOS();

export fn allocateFixedMemory(len: usize, alignment: u16) ?Value {
    return exporter.allocateFixedMemory(len, alignment);
}

export fn freeFixedMemory(bytes: [*]u8, len: usize, alignment: u16) void {
    exporter.freeFixedMemory(bytes, len, alignment);
}

export fn allocateShadowMemory(call: Call, len: usize, alignment: u16) ?Value {
    return exporter.allocateShadowMemory(call, len, alignment);
}

export fn freeShadowMemory(call: Call, bytes: [*]u8, len: usize, alignment: u16) void {
    exporter.freeShadowMemory(call, bytes, len, alignment);
}

export fn defineStructures() ?Value {
    return exporter.defineStructures(package);
}

export fn runThunk(thunk: Thunk, arg_struct: ?Value) ?Value {
    return exporter.runThunk(thunk, arg_struct);
}

export fn isRuntimeSafetyActive() bool {
    return exporter.isRuntimeSafetyActive();
}
