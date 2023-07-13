const exporter = @import("wasm-exporter");
const package = @import("package");
const runFn = exporter.exportModule(package);

export fn run(call_id: usize, arg_index: usize) usize {
    return runFn(call_id, arg_index);
}
