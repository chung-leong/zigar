const exporter = @import("wasm-exporter");
const package = @import("package");
const initFn = exporter.setStage2Callbacks;
const runFn = exporter.exportModuleFunctions(package);
const getFn = exporter.exportModuleVariables(package);

export fn init() void {
    initFn();
}

export fn run(call_id: usize, arg_index: usize, thunk_index: usize) usize {
    return runFn(call_id, arg_index, thunk_index);
}

export fn get(variable_index: usize) usize {
    return getFn(variable_index);
}
