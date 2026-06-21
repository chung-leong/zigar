const std = @import("std");

const accessor = @import("accessor.zig");
const cache = @import("cache.zig");
const failure = @import("failure.zig");
const Error = failure.Error;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const Array = php.Array;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const Long = php.Long;
const N = php.getStaticString;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const ZigException = struct {
    name: *String,
    message: Value,
    string: Value,
    file: Value,
    trace: Value,
    line: Value,
    code: Value,
    previous: Value,
    php_portion: Object = undefined,

    var class_entry: *ClassEntry = undefined;
    var handlers: ObjectHandlers = undefined;

    const class_name = "ZigException";
    const PropCache = cache.IdCache(.{ .message, .string, .code, .file, .line, .trace, .previous }, "", .{});

    pub inline fn object(self: *@This()) *Object {
        return &self.php_portion;
    }

    pub inline fn fromObject(obj: *Object) *@This() {
        return @fieldParentPtr("php_portion", obj);
    }

    pub fn fromValue(value: *const Value) !*@This() {
        const obj = try php.getValueObject(value);
        return fromObject(obj);
    }

    pub fn toValue(self: *@This()) Value {
        return php.createValueObject(php.reuse(self.object()));
    }

    pub inline fn entry() *ClassEntry {
        return class_entry;
    }

    pub fn isInstance(obj: *Object) bool {
        return php.instanceOf(obj, class_entry);
    }

    pub fn isPartOf(self: *@This(), class: *ZigClassEntry) bool {
        if (class.flags.error_set.is_global) return true;
        return if (class.getMember(.static, self.name)) |_| true else |_| false;
    }

    pub fn create(name: *String, code: Long) !*Object {
        const prop_size = php.getObjectPropertySize(class_entry);
        const size: usize = @intCast(@sizeOf(@This()) + prop_size);
        const mem = php.emalloc(size, @src()) orelse return error.OutOfMemory;
        errdefer php.efree(mem, @src());
        const self: *@This() = @ptrCast(@alignCast(mem));
        const message = createDecamelizedMessage(name);
        self.* = .{
            .name = php.reuse(name),
            .message = php.createValueString(message),
            .string = php.createValueStringContent(""),
            .file = php.createValueStringContent(""),
            .trace = php.createValueArray(null),
            .line = php.createValueNull(),
            .code = php.createValueLong(code),
            .previous = php.createValueNull(),
        };
        // initialize the PHP portion
        const obj = self.object();
        obj.handlers = &handlers;
        php.initializeStandardObject(obj, class_entry);
        return obj;
    }

    pub fn acquireDebugInfo(self: *@This()) void {
        php.release(&self.trace);
        php.release(&self.file);
        const trace = php.getBacktrace();
        const file = php.getCurrentFile();
        const line = php.getCurrentLine();
        self.trace = php.createValueArray(trace catch null);
        self.file = php.createValueString(file);
        self.line = php.createValueLong(@intCast(line));
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        php.release(self.name);
        php.release(&self.message);
        php.release(&self.string);
        php.release(&self.file);
        php.release(&self.trace);
    }

    pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
        const desired_type = try php.ValueType.fromInt(type_id);
        const self = fromObject(obj);
        retval.* = switch (desired_type) {
            .string => php.reuse(&self.message).*,
            .long => self.code,
            .boolean => php.createValueBool(true),
            else => return php.FAILURE,
        };
        return php.SUCCESS;
    }

    pub fn readProperty(obj: *Object, name: *String, _: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        const self = fromObject(obj);
        if (PropCache.idFromString(name, cache_slot)) |id| {
            return switch (id) {
                inline else => |t| &@field(self, @tagName(t)),
            };
        } else {
            _ = &failure.report("no field named '{s}' in {s}", .{
                php.getStringContent(name),
                class_name,
            });
            retval.* = php.createValueNull();
            return retval;
        }
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        const self = fromObject(obj);
        if (PropCache.idFromString(name, cache_slot)) |id| {
            switch (id) {
                inline else => |t| {
                    const ptr = &@field(self, @tagName(t));
                    php.release(ptr);
                    ptr.* = php.reuse(value).*;
                },
            }
        } else {
            return failure.report("no field named '{s}' in {s}", .{
                php.getStringContent(name),
                class_name,
            });
        }
        return value;
    }

    pub fn hasProperty(_: *Object, name: *String, _: c_int, cache_slot: ?[*]?*anyopaque) c_int {
        return if (PropCache.idFromString(name, cache_slot) != null) 1 else 0;
    }

    pub fn getProperties(obj: *Object) !*HashTable {
        const ht = try getPropertiesFor(obj, @intFromEnum(php.PropPurpose.array_cast));
        ht.gc.refcount = 0;
        return ht;
    }

    pub fn getPropertiesFor(obj: *Object, purpose_i: c_uint) !*HashTable {
        const purpose: php.PropPurpose = @enumFromInt(purpose_i);
        const self = fromObject(obj);
        const ht = php.createArray();
        switch (purpose) {
            .debug, .json => php.setHashEntryRef(ht, "error", &self.message),
            else => {},
        }
        return ht;
    }

    pub fn getGarbageCollection(obj: *Object, table: *[*c]Value, n: *c_int) !?*HashTable {
        _ = obj;
        _ = table;
        n.* = 0;
        return null;
    }

    pub fn registerClass() !void {
        var ce: ClassEntry = .{ .name = N(class_name) };
        const parent_ce = php.getClassEntry(.exception);
        class_entry = try php.registerInternalClass(&ce, parent_ce);
        handlers = php.createHandlerTable(@This(), @offsetOf(@This(), "php_portion"));
    }

    pub fn unregisterClass() void {
        php.unregisterInternalClass(class_entry);
    }

    fn getSelf(value: *Value) !*@This() {
        const obj = try php.getValueObject(value);
        return fromObject(obj);
    }
};

fn createDecamelizedMessage(name_obj: *const String) *String {
    const name = php.getStringContent(name_obj);
    var len_required: usize = 0;
    for (name, 0..) |c, i| {
        if (std.ascii.isUpper(c)) {
            len_required += if (i > 0) 2 else 1;
        } else {
            len_required += 1;
        }
    }
    const message = php.createStringWithLength(len_required);
    var buffer = @constCast(php.getStringContent(message));
    var len: usize = 0;
    for (name, 0..) |c, i| {
        if (std.ascii.isUpper(c)) {
            if (i > 0) {
                buffer[len] = ' ';
                len += 1;
            }
            buffer[len] = std.ascii.toLower(c);
            len += 1;
        } else {
            buffer[len] = c;
            len += 1;
        }
    }
    // set sentinel
    buffer.ptr[len] = 0;
    return message;
}
