const ex = @import("./src/zig/export.zig");

export const zig_module = ex.createModule(@import("./test-target.zig"));
