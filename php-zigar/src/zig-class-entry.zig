const std = @import("std");

const module_host = @import("module-host.zig");
const Host = module_host.ModuleHost;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const Value = php.Value;

pub const ZigClassEntry = struct {
    host: *Host,
    instance: struct {
        members: *Value,
        template: ?*Value,
    },
    static: struct {
        members: *Value,
        template: ?*php.Value,
    },
    php_class_entry: ClassEntry,

    threadlocal var last_host: *Host = undefined;
    threadlocal var next_class_id: usize = undefined;

    pub fn register(host: *Host, info: *Value) !Value {
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.host = host;
        const instance = try php.getProperty(info, "instance");
        self.instance.members = try php.getProperty(instance, "members");
        self.instance.template = php.getProperty(instance, "template") catch null;
        // const static = try php.getProperty(info, "static");
        // self.static.members = try php.getProperty(static, "members");
        // self.static.template = php.getProperty(static, "template") catch null;
        const ce = &self.php_class_entry;
        ce.type = php.USER_CLASS;
        php.initializeClassData(ce, true);
        var buffer: [64]u8 = undefined;
        var name_buf: []const u8 = undefined;
        if (last_host != host) {
            last_host = host;
            next_class_id = 1;
        }
        const eg = php.getExecutorGlobals();
        while (true) {
            name_buf = try std.fmt.bufPrint(&buffer, "zigar_class_{d}", .{next_class_id});
            next_class_id += 1;
            _ = php.getHashTableEntry(eg.class_table, name_buf) catch break;
        }
        std.debug.print("{s}\n", .{name_buf});
        const name = php.createString(name_buf);
        ce.name = name.value.str;
        ce.ce_flags |= php.NOT_SERIALIZABLE;
        var ce_ptr = php.createPointer(ce);
        try php.setHashTableEntry(eg.class_table, name_buf, &ce_ptr);
        return name;
    }
};
