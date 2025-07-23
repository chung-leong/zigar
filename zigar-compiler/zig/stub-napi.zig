pub const host = @import("./host-napi.zig");

export const zig_module = host.createModule(@import("module"));
