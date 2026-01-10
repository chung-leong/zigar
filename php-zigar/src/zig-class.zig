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
    } = undefined,
    static: struct {
        members: *Value,
        template: ?*Value,
    } = undefined,
    php_class_entry: ClassEntry = undefined,

    var ref_object_handlers: ?php.ObjectHandlers = null;

    pub fn entry(self: *@This()) *ClassEntry {
        return &self.php_class_entry;
    }

    pub fn fromEntry(ce: *ClassEntry) *@This() {
        return @fieldParentPtr("php_class_entry", ce);
    }

    pub fn addRef(self: *@This()) void {
        self.php_class_entry.refcount += 1;
        // std.debug.print("reference class (ref = {d})\n", .{self.php_class_entry.refcount});
    }

    pub fn release(self: *@This()) void {
        self.php_class_entry.refcount -= 1;
        // std.debug.print("release class (ref = {d})\n", .{self.php_class_entry.refcount});
        if (self.php_class_entry.refcount == 0) {
            // std.debug.print("freeing class\n", .{});
            self.host.release();
            // TODO: clear hash tables
            php.allocator.destroy(self);
        }
    }

    pub fn define(host: *Host, info: *Value) !void {
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        const instance = try php.getProperty(info, "instance");
        self.* = .{
            .host = host,
            .instance = .{
                .members = try php.getProperty(instance, "members"),
                .template = php.getProperty(instance, "template") catch null,
            },
        };
        const ce = &self.php_class_entry;
        ce.* = .{
            .type = php.USER_CLASS,
            .refcount = 1,
            .ce_flags = php.NOT_SERIALIZABLE | php.LINKED,
            .properties_info = php.createHashTable(.none),
            .constants_table = php.createHashTable(.none),
            .function_table = php.createHashTable(.function),
            .info = .{
                .user = .{
                    .filename = php.createString("filename"),
                },
            },
            .unnamed_1 = .{
                .create_object = php.transform(createObject),
            },
        };
        var ref = try createRef(ce);
        try php.setProperty(info, "class", &ref);
        host.addRef();
    }

    pub fn finalize(info: *Value) !void {
        const ref = try php.getProperty(info, "class");
        const obj = try php.getValueObject(ref);
        const self = fromEntry(obj.ce);
        const static = try php.getProperty(info, "static");
        self.static.members = try php.getProperty(static, "members");
        self.static.template = php.getProperty(static, "template") catch null;
    }

    fn createRef(ce: *ClassEntry) !Value {
        const ref = php.createValueObject(ce);
        const obj = php.getValueObject(&ref) catch unreachable;
        if (ref_object_handlers == null) {
            ref_object_handlers = php.std_object_handlers.*;
            const handlers = &ref_object_handlers.?;
            handlers.read_property = php.transform(readProperty);
            handlers.dtor_obj = php.transform(destroyRef);
        }
        obj.handlers = &ref_object_handlers.?;
        return ref;
    }

    fn destroyRef(obj: *Object) void {
        // std.debug.print("freeing class ref\n", .{});
        const self = fromEntry(obj.ce);
        self.release();
    }

    fn createObject(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        const zig_obj = try ZigObject.create(self);
        self.addRef();
        return zig_obj.object();
    }

    fn readProperty(obj: *Object, name: *php.String, prop_type: c_int, cache_slot: *?*anyopaque, retval: *Value) !*Value {
        _ = obj;
        _ = name;
        _ = prop_type;
        _ = cache_slot;
        retval.* = php.createValueLong(456);
        return retval;
    }
};
