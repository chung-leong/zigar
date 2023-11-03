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

export fn define() usize {
    return exporter.exportModule(package);
}

export fn run(thunk_address: usize, arg_address: usize) usize {
    return exporter.runThunk(thunk_address, arg_address);
}

export fn safe() u8 {
    return exporter.getRuntimeSafety();
}
