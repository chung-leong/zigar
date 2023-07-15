const exporter = @import("exporter");
const package = @import("package");
const initFn = exporter.setStage1Callbacks;
const runFn = exporter.exportModule(package);

export fn init() void {
    initFn();
}

export fn run(call_id: usize, arg_index: usize) usize {
    return runFn(call_id, arg_index);
}
