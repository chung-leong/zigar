export fn run(call_id: usize, arg_struct_index: usize) usize {
    return @import("exporter-wasm").exportModule(call_id, arg_struct_index, @import("package"));
}
