const std = @import("std");
const exporter = @import("exporter");
const package = @import("package");

pub const os = exporter.getOS();

export fn allocateFixedMemory(len: usize, alignment: u16) usize {
    return exporter.allocateFixedMemory(len, alignment);
}

export fn freeFixedMemory(byte_addr: usize, len: usize, alignment: u16) void {
    exporter.freeFixedMemory(byte_addr, len, alignment);
}

export fn allocateShadowMemory(call_addr: usize, len: usize, alignment: u16) usize {
    return exporter.allocateShadowMemory(call_addr, len, alignment);
}

export fn freeShadowMemory(call_addr: usize, byte_addr: usize, len: usize, alignment: u16) void {
    exporter.freeShadowMemory(call_addr, byte_addr, len, alignment);
}

export fn defineStructures() usize {
    return exporter.defineStructures(package);
}

export fn runThunk(thunk_address: usize, arg_struct: usize) usize {
    return exporter.runThunk(thunk_address, arg_struct);
}

export fn isRuntimeSafetyActive() u8 {
    return exporter.isRuntimeSafetyActive();
}
