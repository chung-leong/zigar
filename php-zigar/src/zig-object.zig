const std = @import("std");

const module_host = @import("module-host.zig");
const php = @import("php.zig");
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const HashTable = php.HashTable;
const zig_class_entry = @import("zig-class-entry.zig");
const ZigClassEntry = zig_class_entry.ZigClassEntry;

pub const ZigObject = struct {
    bytes: ?*String,
    slots: ?*HashTable,
    php_object: php.Object,

    var object_handlers: ?php.ObjectHandlers = null;

    pub fn object(self: *@This()) *Object {
        return &self.php_object;
    }

    pub fn fromObject(obj: *Object) *@This() {
        return @fieldParentPtr("php_object", obj);
    }

    pub fn create(class: *ZigClassEntry) !*@This() {
        const prop_size = php.getObjectPropertySize(class.entry());
        const size: usize = @intCast(@sizeOf(@This()) + prop_size);
        const alignment = comptime std.mem.Alignment.fromByteUnits(@alignOf(@This()));
        const bytes = try php.allocator.alignedAlloc(u8, alignment, size);
        const self: *@This() = @ptrCast(@alignCast(&bytes[0]));
        self.bytes = null;
        self.slots = null;
        const obj = self.object();
        obj.* = .{};
        php.initializeStandardObject(self.object(), class.entry());
        php.initializeObjectProperties(self.object(), class.entry());
        if (object_handlers == null) {
            object_handlers = php.std_object_handlers.*;
            const handlers = &object_handlers.?;
            handlers.free_obj = php.transform(freeObject);
            handlers.read_property = php.transform(readProperty);
        }
        obj.handlers = &object_handlers.?;
        return self;
    }

    fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        if (self.bytes) |s| php.releaseString(s);
        php.allocator.destroy(self);
    }

    fn readProperty(obj: *Object, name: *php.String, prop_type: c_int, cache_slot: *?*anyopaque, retval: *Value) !*Value {
        _ = obj;
        _ = name;
        _ = prop_type;
        _ = cache_slot;
        retval.* = php.createLong(1234);
        return retval;
    }
};

comptime {
    if (@offsetOf(ZigObject, "php_object") + @sizeOf(Object) != @sizeOf(ZigObject)) {
        @compileError("PHP object is in the wrong position");
    }
}
