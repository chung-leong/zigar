const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const MemoryMap = @import("memory-map.zig").MemoryMap;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const ObjectHandlers = php.ObjectHandlers;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const RelativePosition = @import("memory-map.zig").RelativePosition;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub fn ZigObject(comptime S: type) type {
    const Result = struct {
        zig_portion: S = .{},
        php_portion: php.Object = .{},

        var object_handlers: ?ObjectHandlers = null;

        pub inline fn object(self: *@This()) *Object {
            return &self.php_portion;
        }

        pub inline fn structure(self: *@This()) *S {
            return &self.zig_portion;
        }

        pub inline fn fromObject(obj: *Object) *@This() {
            return @fieldParentPtr("php_portion", obj);
        }

        pub inline fn fromStructure(s: *S) *@This() {
            return @alignCast(@fieldParentPtr("zig_portion", s));
        }

        pub fn create(class: *ZigClassEntry) !*@This() {
            const prop_size = php.getObjectPropertySize(class.entry());
            const size: usize = @intCast(@sizeOf(@This()) + prop_size);
            // we can't use the allocator here, since freeing is done by PHP itself
            const mem = php.emalloc(size) orelse return error.OutOfMemory;
            errdefer php.efree(mem);
            const self: *@This() = @ptrCast(@alignCast(mem));
            self.* = .{};
            const obj = self.object();
            obj.handlers = getHandlers();
            php.initializeStandardObject(self.object(), class.entry());
            php.initializeObjectProperties(self.object(), class.entry());
            class.addRef();
            return self;
        }

        pub fn setStorage(self: *@This(), buffer: *ByteBuffer, table: *const Value) !void {
            return try self.zig_portion.setStorage(buffer, table);
        }

        pub fn isInstance(obj: *Object) bool {
            return obj.handlers == getHandlers();
        }

        fn getHandlers() *ObjectHandlers {
            if (object_handlers == null) {
                object_handlers = init: {
                    var handlers: ObjectHandlers = undefined;
                    handlers.offset = @offsetOf(@This(), "php_portion");
                    inline for (comptime std.meta.fields(@TypeOf(object_handler_mapping))) |field| {
                        const func_name = @field(object_handler_mapping, field.name);
                        @field(handlers, field.name) = if (@hasDecl(S, func_name))
                            php.transform(@field(S, func_name))
                        else if (@hasField(@TypeOf(php.std_object_handlers.*), field.name))
                            @field(php.std_object_handlers, field.name)
                        else
                            null;
                    }
                    break :init handlers;
                };
            }
            return &object_handlers.?;
        }
    };
    if (@offsetOf(Result, "php_portion") + @sizeOf(Object) != @sizeOf(Result)) {
        @compileError("PHP object is in the wrong position");
    }
    if (@hasField(S, "buffer") and @offsetOf(S, "buffer") + @sizeOf(*ByteBuffer) != @sizeOf(S)) {
        @compileError("Field 'buffer' is in the wrong position in " ++ @typeName(S));
    }
    return Result;
}

pub const ObjectMap = struct {
    map: Map = .{},

    const Map = MemoryMap(*Object, php.allocator, compareObjects);
    const SearchResult = Map.SearchResult;
    const GenericObject = struct {
        buffer: *ByteBuffer,
        php_portion: php.Object,
    };

    pub fn deinit(self: *@This()) void {
        self.map.deinit();
    }

    pub fn add(self: *@This(), obj: *Object) !void {
        try self.map.add(obj, obj);
    }

    pub fn insert(self: *@This(), result: SearchResult, obj: *Object) !void {
        try self.map.insert(result, obj);
    }

    pub fn remove(self: *@This(), obj: *Object) void {
        self.map.remove(obj);
    }

    pub fn search(self: *@This(), bytes: []const u8, ce: ?*ClassEntry, is_read_only: bool) SearchResult {
        var fake_buf: ByteBuffer = .{
            .bytes = @constCast(bytes),
            .alignment = undefined,
            .ref_count = undefined,
            .flags = .{ .is_read_only = is_read_only },
            .source = undefined,
        };
        var b: GenericObject = .{
            .buffer = &fake_buf,
            .php_portion = .{
                .ce = ce,
                .gc = undefined,
                .handle = undefined,
                .handlers = undefined,
                .properties = undefined,
                .properties_table = undefined,
            },
        };
        return self.map.search(&b.php_portion);
    }

    pub fn find(self: *@This(), bytes: []const u8) ?*Object {
        var result = self.search(bytes, null, false);
        if (result.match != .yes) {
            result = self.search(bytes, null, true);
            if (result.match != .yes) return null;
        }
        return result.value();
    }

    pub fn findBuffer(self: *@This(), bytes: []const u8) ?*ByteBuffer {
        const obj = self.find(bytes) orelse return null;
        return getObjectBuffer(obj);
    }

    pub fn acquireBuffer(self: *@This(), bytes: []const u8, is_read_only: bool) !?*ByteBuffer {
        const result = self.search(bytes, null, is_read_only);
        return switch (result.match) {
            .yes => use: {
                var buf = getObjectBuffer(result.value());
                if (buf.flags.is_read_only == is_read_only) {
                    buf.addRef();
                } else {
                    buf = try buf.duplciate();
                    if (is_read_only) buf.protect();
                }
                break :use buf;
            },
            .outside => slice: {
                const parent_buf = getObjectBuffer(result.value());
                const offset = @intFromPtr(bytes.ptr) - @intFromPtr(parent_buf.bytes.ptr);
                const buf = try parent_buf.slice(offset, bytes.len);
                if (is_read_only) buf.protect();
                break :slice buf;
            },
            else => null,
        };
    }

    fn getObjectBuffer(obj: *const Object) *ByteBuffer {
        const ptr: *const GenericObject = @fieldParentPtr("php_portion", obj);
        return ptr.buffer;
    }

    fn compareObjects(a: *const Object, b: *const Object) RelativePosition {
        const buf_a = getObjectBuffer(a);
        const buf_b = getObjectBuffer(b);
        return switch (buf_a.compare(buf_b)) {
            .a_is_b => if (a.ce == b.ce or b.ce == null)
                if (buf_a.flags.is_read_only == buf_b.flags.is_read_only)
                    .a_is_b
                else if (buf_b.flags.is_read_only)
                    .a_before_b
                else
                    .b_before_a
            else if (a.ce < b.ce)
                .a_before_b
            else
                .b_before_a,
            else => |pos| pos,
        };
    }
};

const object_handler_mapping = .{
    .free_obj = "freeObject",
    .dtor_obj = "destroyObject",
    .clone_obj = "cloneObject",
    .cast_object = "castObject",
    .read_property = "readProperty",
    .write_property = "writeProperty",
    .unset_property = "unsetProperty",
    .has_property = "hasProperty",
    .get_properties = "getProperties",
    .get_properties_for = "getPropertiesFor",
    .get_property_ptr_ptr = "getPropertyPointer",
    .read_dimension = "readElement",
    .write_dimension = "writeElement",
    .unset_dimension = "unsetElement",
    .has_dimension = "hasElement",
    .count_elements = "countElements",
    .get_constructor = "getConstructor",
    .get_method = "getMethod",
    .get_closure = "getClosure",
    .get_class_name = "getClassName",
    .get_debug_info = "getDebugInfo",
    .get_gc = "getReferencedObjects",
    .compare = "compare",
    .do_operation = "doOperation",
};
