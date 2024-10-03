const host = @import("host-c.zig");

export const zig_module = host.createModule(@import("module"));
