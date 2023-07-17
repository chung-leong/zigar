const exporter = @import("exporter");
const package = @import("package");
const initFn = exporter.setStage1Callbacks;
const runFn = exporter.exportModule(package);

export fn init() void {
    initFn();
}

export fn run(arg_index: usize, thunk_index: usize) usize {
    return runFn(arg_index, thunk_index);
}
