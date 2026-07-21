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
const Long = php.Long;
const N = php.getStaticString;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const SpecialExports = struct {
    host: *ModuleHost,
    root: *Object,
    class_entry: ClassEntry,
    handlers: ObjectHandlers,
    methods: Methods,
    php_portion: Object = undefined,

    pub const Methods = struct {
        redirect: Function,
        alignOf: Function,
        sizeOf: Function,
        typeOf: Function,
        import: Function,
        unimport: Function,
        set: Function,
        describe: Function,

        pub const Cache = cache.IdCache(.{
            .alignOf,
            .redirect,
            .sizeOf,
            .typeOf,
            .import,
            .unimport,
            .set,
            .describe,
        }, "", .{});
    };
    pub const StreamNameCache = cache.IdCache(.{ .root, .stderr, .stdin, .stdout }, "", .{});
    pub const SystemObjectNameCache = cache.IdCache(.{.env}, "", .{});

    pub inline fn object(self: *@This()) *Object {
        return &self.php_portion;
    }

    pub inline fn fromObject(obj: *Object) *@This() {
        return @fieldParentPtr("php_portion", obj);
    }

    pub fn create(class: *ZigClassEntry) !*Object {
        var class_entry: ClassEntry = .{
            .type = php.INTERNAL_CLASS,
            .refcount = 1,
            .name = N("Zigar"),
            .ce_flags = php.LINKED | php.RESOLVED_INTERFACES,
            .properties_info = php.createHashTable(null),
            .constants_table = php.createHashTable(null),
            .function_table = php.createHashTable(php.getDestructor(.function)),
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
                .user = .{ .filename = class.host.module_path },
            },
        };
        const prop_size = php.getObjectPropertySize(&class_entry);
        const size: usize = @intCast(@sizeOf(@This()) + prop_size);
        const mem = php.emalloc(size, @src()) orelse return error.OutOfMemory;
        errdefer php.efree(mem, @src());
        const self: *@This() = @ptrCast(@alignCast(mem));
        self.* = .{
            .host = class.host,
            .root = class.object,
            .class_entry = class_entry,
            .handlers = php.createHandlerTable(@This(), @offsetOf(@This(), "php_portion")),
            .methods = .{
                .alignOf = php.createTransformedFunction(handleAlignOf, "alignOf", 1, false),
                .redirect = php.createTransformedFunction(handleRedirect, "redirect", 2, false),
                .sizeOf = php.createTransformedFunction(handleSizeOf, "sizeOf", 1, false),
                .typeOf = php.createTransformedFunction(handleTypeOf, "typeOf", 1, false),
                .import = php.createTransformedFunction(handleImport, "import", 0, false),
                .unimport = php.createTransformedFunction(handleUnimport, "unimport", 0, false),
                .set = php.createTransformedFunction(handleSet, "set", 2, false),
                .describe = php.createTransformedFunction(handleDescribe, "describe", 1, false),
            },
        };
        class.host.addRef();
        php.addRef(class.object);
        // initialize the PHP portion
        const obj = self.object();
        php.initializeStandardObject(obj, &self.class_entry);
        // handlers need to be set after zend_object_std_init() due to change in PHP 8.3
        obj.handlers = &self.handlers;
        return obj;
    }

    pub fn findMethod(self: *@This(), name: *String) !?*php.Function {
        const id_cache: Methods.Cache = .{ .mask = self.host.cache_mask };
        const id = id_cache.idFromString(name, null) orelse return null;
        return switch (id) {
            inline else => |t| &@field(self.methods, @tagName(t)),
        };
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        self.host.release();
        php.release(self.root);
    }

    pub fn readProperty(obj: *Object, name: *String, _: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        _ = .{ obj, name, cache_slot };
        php.throwError(error.Missing);
        retval.* = php.createValueNull();
        return retval;
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        _ = .{ obj, value, name, cache_slot };
        return error.Missing;
    }

    pub fn hasProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) c_int {
        _ = .{ prop_type, obj, name, cache_slot };
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
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(1, 1, "alignOf");
        const class = try getClassFromArgument(&arg_iter);
        retval.* = php.createValueAnyInt(class.alignment.toByteUnits());
    }

    pub fn handleRedirect(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(2, 2, "redirect");
        const obj = try php.getValueObject(arg_iter.this);
        const self = fromObject(obj);
        if (!self.host.isRedirecting()) {
            return failure.report("redirection disabled", .{});
        }
        const arg0 = arg_iter.next() orelse return error.NotString;
        const name = try php.getValueString(arg0);
        const arg1 = arg_iter.next() orelse return error.NotString;
        const name_cache: StreamNameCache = .{ .mask = self.host.cache_mask };
        const stream_id = name_cache.idFromString(name, null) orelse {
            return failure.report("expecting 'stdin', 'stdout', 'stderr', or 'root', received: {s}", .{
                php.getStringContent(name),
            });
        };
        const fd: Long = switch (stream_id) {
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
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(1, 1, "sizeOf");
        const class = try getClassFromArgument(&arg_iter);
        retval.* = if (class.byte_size) |sz| php.createValueAnyInt(sz) else php.createValueNull();
    }

    pub fn handleTypeOf(ed: *ExecuteData, retval: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(1, 1, "typeOf");
        const class = try getClassFromArgument(&arg_iter);
        retval.* = php.createValueStringContent(class.getStructureName());
    }

    pub fn handleImport(ed: *ExecuteData, retval: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(0, 1, "import");
        const arg0 = arg_iter.next();
        const root_static = try getRootStaticData(&arg_iter);
        retval.* = try root_static.exportSymbolsToGlobalNamespace(arg0);
    }

    pub fn handleUnimport(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(0, 0, "unimport");
        const root_static = try getRootStaticData(&arg_iter);
        try root_static.removeSymbolsFromGlobalNamespace();
    }

    pub fn handleSet(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(2, 2, "set");
        const obj = try php.getValueObject(arg_iter.this);
        const self = fromObject(obj);
        const arg0 = arg_iter.next() orelse return error.NotString;
        const name = try php.getValueString(arg0);
        const name_cache: SystemObjectNameCache = .{ .mask = self.host.cache_mask };
        const sys_obj_id = name_cache.idFromString(name, null) orelse {
            return failure.report("expecting 'env', received: {s}", .{
                php.getStringContent(name),
            });
        };
        switch (sys_obj_id) {
            .env => {
                const arg1 = arg_iter.next() orelse return error.NotArrayOrObject;
                const ht = try php.getValueHashTable(arg1);
                try self.host.dispatcher.setEnvironmentVariables(ht);
            },
        }
    }

    pub fn handleDescribe(ed: *ExecuteData, retval: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(1, 2, "describe");
        const obj = try php.getValueObject(arg_iter.this);
        const self = fromObject(obj);
        const arg0 = arg_iter.next().?;
        const strm = try php.getValueStream(arg0);
        const is_dir = if (arg_iter.next()) |arg1| try php.getValueBool(arg1) else false;
        const fd = try self.host.dispatcher.addStream(strm, is_dir);
        retval.* = php.createValueLong(fd);
    }

    fn getRootStaticData(arg_iter: *ArgumentIterator) !*structure.Struct.Static {
        const obj = try php.getValueObject(arg_iter.this);
        const self = fromObject(obj);
        const root_class = ZigClassEntry.fromObject(self.root);
        return root_class.getStaticData(structure.Struct);
    }

    fn getClassFromArgument(arg_iter: *ArgumentIterator) !*ZigClassEntry {
        const arg0 = arg_iter.next() orelse return error.NotString;
        const obj = try php.getValueObject(arg0);
        if (!ZigClassEntry.isZig(obj.ce)) {
            return error.NotZigClass;
        }
        return ZigClassEntry.fromObject(obj);
    }
};
