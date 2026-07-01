const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const memory_map = @import("memory-map.zig");
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const ObjectHandlers = php.ObjectHandlers;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub fn ZigObject(comptime S: type) type {
    const Result = struct {
        zig_portion: S = .{},
        php_portion: Object = .{},

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
            const mem = php.emalloc(size, @src()) orelse return error.OutOfMemory;
            errdefer php.efree(mem, @src());
            const self: *@This() = @ptrCast(@alignCast(mem));
            // initialize the Zig portion
            self.zig_portion = .{};
            // initialize the PHP portion
            const obj = self.object();
            php.initializeStandardObject(obj, ce);
            // handlers get set to null by zend_object_std_init() starting from PHP 8.3
            // so this call needs to happen here
            obj.handlers = getHandlers();
            return self;
        }

        pub fn isInstance(obj: *Object) bool {
            return obj.handlers == getHandlers();
        }

        fn getHandlers() *ObjectHandlers {
            if (object_handlers == null) {
                object_handlers = php.createHandlerTable(S, @offsetOf(@This(), "php_portion"));
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

    const Map = memory_map.MemoryMap(*Object, php.allocator, compare);
    const SearchResult = memory_map.SearchResult;
    const RelativePosition = memory_map.RelativePosition;

    pub fn deinit(self: *@This()) void {
        self.map.deinit();
    }

    pub fn insert(self: *@This(), result: SearchResult, obj: *Object) !void {
        try self.map.insert(result, obj);
    }

    pub fn remove(self: *@This(), result: SearchResult) void {
        self.map.remove(result);
    }

    pub fn get(self: *@This(), result: SearchResult) ?*Object {
        return self.map.get(result);
    }

    pub fn getBuffer(self: *@This(), result: SearchResult) ?*ByteBuffer {
        const obj = self.map.get(result) orelse return null;
        return getObjectBuffer(obj);
    }

    pub fn getNearestBuffer(self: *@This(), result: SearchResult) ?*ByteBuffer {
        const nearest = self.map.getNearest(result) orelse return null;
        return getObjectBuffer(nearest);
    }

    pub fn find(self: *@This(), b: anytype) SearchResult {
        return self.map.find(b);
    }

    pub fn free(self: *@This(), b: anytype) void {
        var result = self.map.findFirst(b);
        while (self.map.get(result)) |obj| {
            const buf = getObjectBuffer(obj);
            buf.free();
            self.remove(result);
            result = self.map.findAgain(b, result);
        }
    }

    pub fn compareBuffer(a: *const Object, b: anytype) ?RelativePosition {
        switch (@TypeOf(b)) {
            *Object, *const Object => if (a == b) return null,
            else => {},
        }
        const a_buf = getObjectBuffer(a);
        const b_buf = switch (@TypeOf(b)) {
            *Object, *const Object => getObjectBuffer(b),
            else => b,
        };
        return a_buf.compare(b_buf);
    }

    pub fn compareClass(a: *const Object, b: anytype) ?RelativePosition {
        const b_ce = if (comptime hasField(@TypeOf(b), "ce")) b.ce else return null;
        if (@intFromPtr(a.ce) < @intFromPtr(b_ce)) return .ab;
        if (@intFromPtr(a.ce) > @intFromPtr(b_ce)) return .ba;
        return null;
    }

    pub fn compare(a: *const Object, b: anytype) ?RelativePosition {
        return compareBuffer(a, b) orelse compareClass(a, b);
    }

    fn hasField(comptime T: type, comptime name: []const u8) bool {
        return switch (@typeInfo(T)) {
            .pointer => |pt| hasField(pt.child, name),
            else => @hasField(T, name),
        };
    }
};

pub inline fn getObjectBuffer(obj: *const Object) *ByteBuffer {
    const ptr: *const struct {
        buffer: *ByteBuffer,
        php_portion: Object,
    } = @fieldParentPtr("php_portion", obj);
    return ptr.buffer;
}
