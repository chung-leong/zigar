const std = @import("std");

const module = @import("module");

pub const host = @import("./host-napi.zig");

export const zig_module = host.createModule(module);

pub const std_options: std.Options = if (@hasDecl(module, "std_options")) module.std_options else .{};
