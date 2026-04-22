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
            const ce = class.entry();
            const prop_size = php.getObjectPropertySize(ce);
            const size: usize = @intCast(@sizeOf(@This()) + prop_size);
            // we can't use allocator here, since freeing is done by PHP itself
            const mem = php.emalloc(size) orelse return error.OutOfMemory;
            errdefer php.efree(mem);
            const self: *@This() = @ptrCast(@alignCast(mem));
            self.* = .{};
            // initialize the PHP portion
            const obj = self.object();
            obj.handlers = getHandlers();
            php.initializeStandardObject(obj, ce);
            return self;
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
        const buf = getObjectBuffer(obj);
        std.debug.assert(!buf.flags.uninitialized and !buf.flags.temporary);
        try self.map.add(obj);
    }

    pub fn insert(self: *@This(), result: SearchResult, obj: *Object) !void {
        try self.map.insert(result, obj);
    }

    pub fn remove(self: *@This(), obj: *Object) bool {
        const buf = getObjectBuffer(obj);
        std.debug.assert(!buf.flags.uninitialized and !buf.flags.temporary);
        return self.map.remove(obj);
    }

    pub fn search(self: *@This(), bytes: []const u8, ce: ?*ClassEntry, read_only: bool) SearchResult {
        var fake_buf: ByteBuffer = .{
            .bytes = @constCast(bytes),
            .alignment = undefined,
            .ref_count = undefined,
            .flags = .{ .read_only = read_only },
            .source = undefined,
        };
        var b: GenericObject = .{
            .buffer = &fake_buf,
            .php_portion = .{
                .ce = ce,
                .gc = undefined,
                .handle = 0,
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

    pub fn acquireBuffer(self: *@This(), bytes: []const u8, alignment: std.mem.Alignment, read_only: bool) !?*ByteBuffer {
        const result = self.search(bytes, null, read_only);
        return switch (result.match) {
            .yes => use: {
                var buf = getObjectBuffer(result.value());
                if (buf.flags.read_only == read_only) {
                    buf.addRef();
                } else {
                    buf = try buf.duplciate();
                    buf.protect(read_only);
                }
                break :use buf;
            },
            .outside => slice: {
                const parent_buf = getObjectBuffer(result.value());
                const offset = @intFromPtr(bytes.ptr) - @intFromPtr(parent_buf.bytes.ptr);
                const buf = try parent_buf.slice(offset, bytes.len, alignment);
                buf.protect(read_only);
                break :slice buf;
            },
            else => null,
        };
    }

    inline fn getObjectBuffer(obj: *const Object) *ByteBuffer {
        const ptr: *const GenericObject = @fieldParentPtr("php_portion", obj);
        return ptr.buffer;
    }

    fn compareObjects(a: *const Object, b: *const Object) RelativePosition {
        if (a.handle == b.handle) return .a_is_b;
        const buf_a = getObjectBuffer(a);
        const buf_b = getObjectBuffer(b);
        const pos = buf_a.compare(buf_b);
        if (pos != .a_is_b) return pos;
        return if (b.handle == 0 and (a.ce == b.ce or b.ce == null))
            if (buf_a.flags.read_only == buf_b.flags.read_only)
                .a_is_b
            else if (buf_b.flags.read_only)
                .a_before_b
            else
                .b_before_a
        else if (a.handle < b.handle)
            .a_before_b
        else
            .b_before_a;
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
    .get_gc = "getGarbageCollection",
    .compare = "compare",
    .do_operation = "doOperation",
};
