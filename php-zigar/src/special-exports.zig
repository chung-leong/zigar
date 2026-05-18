const std = @import("std");

const cache = @import("cache.zig");
const failure = @import("failure.zig");
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const String = php.String;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const SpecialExports = struct {
    host: *ModuleHost,
    class_entry: ClassEntry,
    handlers: ObjectHandlers,
    methods: Methods,
    php_portion: Object = undefined,

    pub const Methods = struct {
        redirect: Function,
        alignOf: Function,
        sizeOf: Function,
        typeOf: Function,

        pub const Cache = cache.IdCache(.{ .alignOf, .redirect, .sizeOf, .typeOf }, "", .{});
    };
    pub const StreamNameCache = cache.IdCache(.{ .root, .stderr, .stdin, .stdout }, "", .{});

    pub inline fn object(self: *@This()) *Object {
        return &self.php_portion;
    }

    pub inline fn fromObject(obj: *Object) *@This() {
        return @fieldParentPtr("php_portion", obj);
    }

    pub fn create(host: *ModuleHost) !*Object {
        var class_entry: ClassEntry = .{
            .type = php.INTERNAL_CLASS,
            .refcount = 1,
            .name = php.persistent("Zigar"),
            .ce_flags = php.LINKED | php.RESOLVED_INTERFACES,
            .properties_info = php.createHashTable(null),
            .constants_table = php.createHashTable(null),
            .function_table = php.createHashTable(php.destructor.function),
            .unnamed_0 = .{
                .parent = php.getClassEntry(.standard),
            },
            .unnamed_1 = .{
                .create_object = null,
            },
            .unnamed_2 = .{
                .interfaces = null,
            },
            .info = .{
                .user = .{
                    // TODO
                    .filename = php.createString("filename"),
                },
            },
        };
        const prop_size = php.getObjectPropertySize(&class_entry);
        const size: usize = @intCast(@sizeOf(@This()) + prop_size);
        const mem = php.emalloc(size) orelse return error.OutOfMemory;
        errdefer php.efree(mem);
        const self: *@This() = @ptrCast(@alignCast(mem));
        self.* = .{
            .host = host,
            .class_entry = class_entry,
            .handlers = php.createHandlerTable(@This(), @offsetOf(@This(), "php_portion")),
            .methods = .{
                .alignOf = php.createTransformedFunction(handleAlignOf, "alignOf", 1, false),
                .redirect = php.createTransformedFunction(handleRedirect, "redirect", 2, false),
                .sizeOf = php.createTransformedFunction(handleSizeOf, "sizeOf", 1, false),
                .typeOf = php.createTransformedFunction(handleTypeOf, "typeOf", 1, false),
            },
        };
        host.addRef();
        // initialize the PHP portion
        const obj = self.object();
        obj.handlers = &self.handlers;
        php.initializeStandardObject(obj, &self.class_entry);
        return obj;
    }

    pub fn findMethod(self: *@This(), name: *String) !?*php.Function {
        const id = Methods.Cache.idFromString(name, null) orelse return null;
        return switch (id) {
            inline else => |t| &@field(self.methods, @tagName(t)),
        };
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        php.release(self.class_entry.info.user.filename);
        self.host.release();
    }

    pub fn readProperty(obj: *Object, name: *String, _: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        _ = obj;
        _ = name;
        _ = cache_slot;
        php.throwError(error.Missing);
        retval.* = php.createValueNull();
        return retval;
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        _ = obj;
        _ = value;
        _ = name;
        _ = cache_slot;
        return error.Missing;
    }

    pub fn hasProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) c_int {
        _ = prop_type;
        _ = obj;
        _ = name;
        _ = cache_slot;
        return 0;
    }

    pub fn getProperties(obj: *Object) !*HashTable {
        _ = obj;
        const ht = php.createArray();
        ht.gc.refcount = 0;
        return ht;
    }

    pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*php.Function {
        const obj = obj_ptr.*;
        const self = fromObject(obj);
        return try findMethod(self, name);
    }

    pub fn compare(a: *Value, b: *Value) c_int {
        const obj_a = php.getValueObject(a) catch return -1;
        const obj_b = php.getValueObject(b) catch return 1;
        if (obj_a.ce != obj_b.ce) {
            return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
        }
        return if (obj_a.handle == obj_b.handle) 0 else if (obj_a.handle < obj_b.handle) -1 else 1;
    }

    pub fn getGarbageCollection(obj: *Object, table: *[*c]Value, n: *c_int) !?*HashTable {
        _ = obj;
        _ = table;
        n.* = 0;
        return null;
    }

    pub fn handleAlignOf(ed: *ExecuteData, retval: *Value) !void {
        const class = try getClassFromArgument(ed);
        retval.* = php.createValueAnyInt(class.alignment.toByteUnits());
    }

    pub fn handleRedirect(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const obj = try php.getValueObject(arg_iter.this);
        const self = fromObject(obj);
        const arg0 = arg_iter.next() orelse return error.NotString;
        const name = try php.getValueString(arg0);
        const arg1 = arg_iter.next() orelse return error.NotString;
        const stream_id = StreamNameCache.idFromString(name, null) orelse {
            return failure.report("expecting 'stdin', 'stdout', 'stderr', or 'root', received: {s}", .{
                php.getStringContent(name),
            });
        };
        const fd: c_long = switch (stream_id) {
            .stdin => 0,
            .stdout => 1,
            .stderr => 2,
            .root => -1,
        };
        self.host.dispatcher.redirectStream(fd, arg1) catch |err| {
            if (err == error.NotString) {
                const arg1_d = php.createValueDebug(arg1);
                defer php.release(&arg1_d);
                return failure.report("expecting a path or a resource pointer from {s}(), received: {s}", .{
                    if (stream_id == .root) "opendir" else "fopen",
                    php.getValueStringContent(&arg1_d) catch unreachable,
                });
            }
            return err;
        };
    }

    pub fn handleSizeOf(ed: *ExecuteData, retval: *Value) !void {
        const class = try getClassFromArgument(ed);
        retval.* = if (class.byte_size) |sz| php.createValueAnyInt(sz) else php.createValueNull();
    }

    pub fn handleTypeOf(ed: *ExecuteData, retval: *Value) !void {
        const class = try getClassFromArgument(ed);
        retval.* = php.createValueStringContent(class.getStructureName());
    }

    pub fn getClassFromArgument(ed: *ExecuteData) !*ZigClassEntry {
        var arg_iter: ArgumentIterator = .init(ed);
        const arg0 = arg_iter.next() orelse return error.NotString;
        const obj = try php.getValueObject(arg0);
        if (!ZigClassEntry.isZig(obj.ce)) {
            return error.NotZigClass;
        }
        return ZigClassEntry.fromObject(obj);
    }
};
