const exporter = @import("exporter");

pub const os = exporter.getOS();

export const zig_module = exporter.createModule(@import("package"));
