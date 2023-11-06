const std = @import("std");
const exporter = @import("exporter");
const package = @import("package");

pub const os = exporter.getOS();

export fn alloc(call_addr: usize, len: usize, ptr_align: u8) usize {
    return exporter.alloc(call_addr, len, ptr_align);
}

export fn free(call_addr: usize, byte_addr: usize, len: usize, ptr_align: u8) void {
    exporter.free(call_addr, byte_addr, len, ptr_align);
}

export fn define() usize {
    return exporter.exportModule(package);
}

export fn run(thunk_address: usize, arg_struct: usize) usize {
    return exporter.runThunk(thunk_address, arg_struct);
}

export fn safe() u8 {
    return exporter.getRuntimeSafety();
}
