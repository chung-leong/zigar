const module_host = @import("module-host.zig");
const php = @import("php.zig");

const Module = module_host.ModuleHost(php.Value);

pub const ZigClassEntry = struct {
    host: *module_host.ModuleHost,
    instance: struct {
        members: *php.HashTable,
        template: ?*php.HashTable,
    },
    static: struct {
        members: *php.HashTable,
        template: ?*php.HashTable,
    },
    php_class_entry: php.ClassEntry,

    pub fn create(host: *Module, info: *php.HashTable, ctx: php.TsContext) !*@This() {
        var self: *@This() = try php.allocator.create(@This());
        self.host = host;
        const ce = &self.php_class_entry;
        ce.type = php.USER_CLASS;
        // ce.name = name;
        php.initializeClassData(ce, true);
        const eg = ctx.getExecutorGlobals();
        _ = eg;
        _ = info;
        return self;
    }
};
