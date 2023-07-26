const exporter = @import("exporter");
const package = @import("package");

export fn init() void {
    exporter.setCallbacks();
}

export fn define(arg_index: usize) usize {
    return exporter.exportModule(package, arg_index);
}

export fn run(arg_index: usize, thunk_address: usize) usize {
    return exporter.runThunk(arg_index, thunk_address);
}
