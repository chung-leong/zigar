export fn run() usize {
    return @import("exporter-wasm").exportModule(@import("package"));
}
