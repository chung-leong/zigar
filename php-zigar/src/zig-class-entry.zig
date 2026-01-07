const module_host = @import("module-host.zig");
const php = @import("php.zig");

const Module = module_host.ModuleHost(php.Value);

pub const ZigClassEntry = struct {
    pub const ZigClassMember = struct {
        type: Module.MemberType,
        flags: Module.MemberFlags,
    };

    pub const ZigClassTemplate = struct {
        bytes: []const u8,
    };

    host: *module_host.ModuleHost,
    instance: struct {
        members: []ZigClassMember,
        template: ?*ZigClassTemplate,
    },
    static: struct {
        members: []ZigClassMember,
        template: ?*ZigClassTemplate,
    },
    php_class_entry: php.ClassEntry,

    // pub fn create(host: *Module) !*@This() {
    //     var self: *@This() =
    // }
};
