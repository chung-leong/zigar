const std = @import("std");
const exporter = @import("exporter");
const package = @import("package");

pub const os = exporter.getOS();

export fn alloc(ptr: *anyopaque, len: usize, ptr_align: u8) usize {
    return exporter.alloc(ptr, len, ptr_align);
}

export fn free(ptr: *anyopaque, address: usize, len: usize, ptr_align: u8) void {
    exporter.free(ptr, address, len, ptr_align);
}

export fn define(arg_index: usize) usize {
    return exporter.exportModule(package, arg_index);
}

export fn run(arg_index: usize, thunk_address: usize) usize {
    return exporter.runThunk(arg_index, thunk_address);
}

export fn safe() u8 {
    return exporter.getRuntimeSafety();
}
