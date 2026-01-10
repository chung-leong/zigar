const std = @import("std");

const module_host = @import("module-host.zig");
const Host = module_host.ModuleHost;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const ClassEntry = php.ClassEntry;
const Object = php.Object;
const zig_object = @import("zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const ZigClass = struct {
    host: *Host,
    instance: struct {
        members: *Value,
        template: ?*Value,
    },
    static: struct {
        members: *Value,
        template: ?*Value,
    },
    php_class_entry: ClassEntry,

    threadlocal var last_host: *Host = undefined;
    threadlocal var next_class_id: usize = undefined;

    pub fn entry(self: *@This()) *ClassEntry {
        return &self.php_class_entry;
    }

    pub fn fromEntry(ce: *ClassEntry) *@This() {
        return @fieldParentPtr("php_class_entry", ce);
    }

    pub fn define(host: *Host, info: *Value) !void {
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.host = host;
        const instance = try php.getProperty(info, "instance");
        self.instance.members = try php.getProperty(instance, "members");
        self.instance.template = php.getProperty(instance, "template") catch null;
        const ce = &self.php_class_entry;
        ce.* = .{};
        ce.type = php.USER_CLASS;
        ce.refcount = 1;
        ce.ce_flags = php.NOT_SERIALIZABLE | php.LINKED;
        ce.properties_info = php.createHashTable(.none);
        ce.constants_table = php.createHashTable(.none);
        ce.function_table = php.createHashTable(.function);
        ce.unnamed_1.create_object = php.transform(createObject);
        var filename = php.createValueString("filename");
        ce.info.user.filename = php.getValueString(&filename) catch unreachable;
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
        var name = php.createValueString(name_buf);
        ce.name = php.getValueString(&name) catch unreachable;
        try php.setProperty(info, "class_name", &name);
        var ce_ptr = php.createValuePointer(ce);
        try php.setHashTableEntry(eg.class_table, ce.name, &ce_ptr);
    }

    pub fn finalize(info: *Value) !void {
        const name = try php.getProperty(info, "class_name");
        const name_str = try php.getValueString(name);
        const eg = php.getExecutorGlobals();
        const ptr = try php.getHashTableEntry(eg.class_table, name_str);
        const ce: *ClassEntry = @ptrCast(@alignCast(ptr.value.ptr.?));
        const self = fromEntry(ce);
        const static = try php.getProperty(info, "static");
        self.static.members = try php.getProperty(static, "members");
        self.static.template = php.getProperty(static, "template") catch null;
    }

    fn createObject(ce: *ClassEntry) !*Object {
        const zo = try ZigObject.create(fromEntry(ce));
        return zo.object();
    }
};
