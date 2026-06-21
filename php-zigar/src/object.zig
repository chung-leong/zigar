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

        // pub fn fromValue(value: *const Value) !*@This() {
        //     const obj = try php.getValueObject(value);
        //     return fromObject(obj);
        // }

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

    const Map = MemoryMap(*Object, php.allocator, compareObjects);
    const SearchResult = Map.SearchResult;

    pub fn deinit(self: *@This()) void {
        self.map.deinit();
    }

    pub fn add(self: *@This(), obj: *Object) !void {
        const buf = getObjectBuffer(obj);
        std.debug.assert(!buf.flags.uninitialized and !buf.flags.transient);
        try self.map.add(obj);
    }

    pub fn insert(self: *@This(), result: SearchResult, obj: *Object) !void {
        try self.map.insert(result, obj);
    }

    pub fn remove(self: *@This(), obj: *Object) bool {
        const buf = getObjectBuffer(obj);
        std.debug.assert(!buf.flags.uninitialized and !buf.flags.transient);
        return self.map.remove(obj);
    }

    pub fn search(self: *@This(), bytes: []const u8, class: *ZigClassEntry, read_only: bool) SearchResult {
        return self.map.search(.{ .bytes = bytes, .class = class, .read_only = read_only });
    }

    pub fn freeBuffer(self: *@This(), bytes: []const u8) void {
        // mark all buffers within the given range as freed; only the one
        // that performed the allocation will free the actual memory (that
        // should be the one that yields .yes)
        while (true) {
            const result = self.map.search(.{ .bytes = bytes });
            switch (result.match) {
                .yes, .inside => {
                    const buf = getObjectBuffer(result.value());
                    buf.free();
                },
                else => break,
            }
        }
    }

    pub fn acquireBuffer(self: *@This(), bytes: []const u8, alignment: std.mem.Alignment, read_only: bool) !?*ByteBuffer {
        const result = self.map.search(.{ .bytes = bytes, .read_only = read_only });
        switch (result.match) {
            .yes, .outside => {
                var buf = getObjectBuffer(result.value());
                while (true) {
                    if (buf.bytes.ptr == bytes.ptr and buf.bytes.len == bytes.len) {
                        if (buf.flags.read_only == read_only) {
                            buf.addRef();
                            return buf;
                        }
                    }
                    // try the parent buffer if there's one
                    if (buf.getParent()) |p_buf| {
                        buf = p_buf;
                    } else break;
                }
                const offset = @intFromPtr(bytes.ptr) - @intFromPtr(buf.bytes.ptr);
                const len = bytes.len;
                buf = try buf.slice(offset, len, alignment, 0);
                if (read_only) buf.protect();
                return buf;
            },
            else => return null,
        }
    }

    fn compareObjects(a: *const Object, b: anytype) RelativePosition {
        const B = @TypeOf(b);
        if (B == *Object) {
            if (a.handle == b.handle) return .a_is_b;
        }
        const a_buf = getObjectBuffer(a);
        const b_buf = if (B == *Object) getObjectBuffer(b) else {};
        const b_bytes = if (@TypeOf(b_buf) != void) b_buf.bytes else b.bytes;
        // get class entry from B
        const b_ce = if (@typeInfo(B) == .@"struct" and @hasField(B, "class"))
            b.class.entry()
        else if (B == *Object)
            b.ce
        else {};
        // get read-only flag from B
        const b_ro = if (@typeInfo(B) == .@"struct" and @hasField(B, "read_only"))
            b.read_only
        else if (@TypeOf(b_buf) != void)
            b_buf.flags.read_only
        else {};
        return switch (a_buf.compare(.{ .bytes = b_bytes })) {
            .a_is_b => switch (compare(a.ce, b_ce)) {
                .a_is_b => compare(a_buf.flags.read_only, b_ro),
                else => |pos| pos,
            },
            else => |pos| check: {
                if (@TypeOf(b_ce) == void) {
                    if (a_buf.getParent()) |p_buf| {
                        switch (p_buf.compare(.{ .bytes = b_bytes })) {
                            .a_is_b, .a_inside_b, .b_inside_a => |p_pos| {
                                break :check p_pos;
                            },
                            else => {},
                        }
                    }
                }
                break :check pos;
            },
        };
    }

    fn compare(a: anytype, b: anytype) RelativePosition {
        if (@TypeOf(b) == void or a == b) return .a_is_b;
        if (@TypeOf(b) == bool) {
            return if (b) .a_before_b else .b_before_a;
        } else {
            return if (a < b) .a_before_b else .b_before_a;
        }
    }
};

pub inline fn getObjectBuffer(obj: *const Object) *ByteBuffer {
    const ptr: *const struct {
        buffer: *ByteBuffer,
        php_portion: Object,
    } = @fieldParentPtr("php_portion", obj);
    return ptr.buffer;
}
