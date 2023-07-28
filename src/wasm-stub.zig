const exporter = @import("exporter");
const package = @import("package");

export fn alloc(ptr: *anyopaque, len: usize) usize {
    return exporter.alloc(ptr, len);
}

export fn free(ptr: *anyopaque, address: usize, len: usize) void {
    exporter.free(ptr, address, len);
}

export fn define(arg_index: usize) usize {
    return exporter.exportModule(package, arg_index);
}

export fn run(arg_index: usize, thunk_address: usize) usize {
    return exporter.runThunk(arg_index, thunk_address);
}
