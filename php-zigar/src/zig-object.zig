const module_host = @import("module-host.zig");
const php = @import("php.zig");

const ZigObject = struct {
    bytes: []const u8,
    php_object: php.Object,
};
