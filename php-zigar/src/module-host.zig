const std = @import("std");
const c_allocator = std.heap.c_allocator;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const hooks = @import("module/native/hooks.zig");
const interface = @import("module/native/interface.zig");
const php = @import("php.zig");
const Value = php.Value;

pub const ModuleHost = struct {
    module: ?*Module = null,
    library: ?std.DynLib = null,
    base_address: usize = 0,

    const Module = interface.Module(Value);
    const Jscall = Module.Jscall;
};
