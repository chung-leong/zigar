const exporter = @import("exporter");
const package = @import("package");
const initFn = exporter.setStage2Callbacks;
const runFn = exporter.exportModuleFunctions(package);
const getFn = exporter.exportModuleVariables(package);

export fn init() void {
    initFn();
}

export fn run(arg_index: usize, thunk_index: usize) usize {
    return runFn(arg_index, thunk_index);
}

export fn get(variable_index: usize) usize {
    return getFn(variable_index);
}
