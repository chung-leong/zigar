const std = @import("std");

const MemoryMap = @import("memory-map.zig").MemoryMap;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const RelativePosition = @import("memory-map.zig").RelativePosition;

pub const ByteBuffer = struct {
    bytes: []u8 = undefined,
    alignment: std.mem.Alignment = .@"1",
    ref_count: u32 = 1,
    flags: packed struct {
        uninitialized: bool = true,
        read_only: bool = false,
        temporary: bool = false,
        inaccessible: bool = false,
        contains_packed_data: bool = false,
    } = .{},
    source: union(enum) {
        buffer: *ByteBuffer,
        string: *String,
        allocator: *const std.mem.Allocator,
        none: void,
    } = .{ .none = {} },

    pub const Encoding = enum { base64 };

    pub fn data(self: *@This(), index: usize, write_access: bool) ![]u8 {
        if (self.flags.read_only and write_access) return error.WriteProtected;
        if (self.flags.uninitialized) return error.AccessingDeallocatedMemory;
        if (index > self.bytes.len) return error.OutOfBound;
        return self.bytes;
    }

    pub fn create(alignment: std.mem.Alignment) !*@This() {
        const self = try php.allocator.create(@This());
        self.* = .{ .alignment = alignment, .flags = .{} };
        return self;
    }

    pub fn init(bytes: []u8) @This() {
        return .{
            .bytes = bytes,
            .flags = .{
                .temporary = true,
            },
        };
    }

    pub fn allocate(self: *@This(), allocator: ?*const std.mem.Allocator, len: usize) !void {
        std.debug.assert(self.flags.uninitialized);
        defer self.flags.uninitialized = false;
        if (len > 0) {
            const al = allocator orelse &php.allocator;
            const byte_ptr = al.rawAlloc(len, self.alignment, 0) orelse return error.OutOfMemory;
            self.bytes = byte_ptr[0..len];
            self.source = .{ .allocator = al };
        } else {
            self.bytes = &.{};
        }
    }

    pub fn referenceString(self: *@This(), str: *String) void {
        std.debug.assert(self.flags.uninitialized);
        defer self.flags.uninitialized = false;
        self.bytes = @constCast(php.getStringContent(str));
        self.source = .{ .string = str };
        php.addRef(str);
    }

    pub fn referencExternal(self: *@This(), bytes: []const u8) void {
        std.debug.assert(self.flags.uninitialized);
        defer self.flags.uninitialized = false;
        self.bytes = @constCast(bytes);
    }

    pub fn externalize(self: *@This()) bool {
        switch (self.source) {
            .allocator => |al| if (al != &php.allocator) {
                self.source = .{ .none = {} };
                return true;
            },
            else => {},
        }
        return false;
    }

    pub fn slice(self: *@This(), offset: usize, len: usize, alignment: std.mem.Alignment) !*@This() {
        const bytes = try self.data(offset + len, false);
        const new = try php.allocator.create(@This());
        const slice_bytes = bytes[offset .. offset + len];
        std.debug.assert(alignment.check(@intFromPtr(slice_bytes.ptr)));
        var src_buf = self;
        while (src_buf.source == .buffer) {
            src_buf = src_buf.source.buffer;
        }
        src_buf.addRef();
        new.* = .{
            .bytes = slice_bytes,
            .alignment = alignment,
            .flags = self.flags,
            .source = .{ .buffer = src_buf },
        };
        return new;
    }

    pub fn duplciate(self: *@This()) !*@This() {
        const bytes = try self.data(0, false);
        const new = try php.allocator.create(@This());
        new.* = .{
            .bytes = bytes,
            .alignment = self.alignment,
            .flags = self.flags,
            .source = .{ .buffer = self },
        };
        self.addRef();
        return new;
    }

    pub fn protect(self: *@This(), read_only: bool) void {
        self.flags.read_only = read_only;
    }

    pub fn markPackedData(self: *@This()) void {
        self.flags.contains_packed_data = true;
    }

    pub fn copy(self: *@This(), other: *const @This()) !void {
        try self.copyBytes(other.bytes);
    }

    pub fn copyBytes(self: *@This(), bytes: []const u8) !void {
        const dest = try self.data(0, true);
        if (self.bytes.len != bytes.len) return error.LengthMismatch;
        @memcpy(dest, bytes);
    }

    pub fn clear(self: *@This()) !void {
        const dest = try self.data(0, true);
        @memset(dest, 0);
    }

    pub fn addRef(self: *@This()) void {
        if (self.flags.temporary) return;
        self.ref_count += 1;
    }

    pub fn release(self: *@This()) void {
        if (self.flags.temporary) return;
        self.ref_count -= 1;
        if (self.ref_count == 0) {
            switch (self.source) {
                .buffer => |buf| buf.release(),
                .string => |str| php.release(str),
                .allocator => |al| al.rawFree(self.bytes, self.alignment, 0),
                .none => {},
            }
            php.allocator.destroy(self);
        }
    }

    pub fn free(self: *@This()) void {
        switch (self.source) {
            .allocator => |al| {
                al.rawFree(self.bytes, self.alignment, 0);
                self.flags.uninitialized = true;
                self.source = .{ .none = {} };
            },
            else => {},
        }
    }

    pub fn getString(self: *@This(), encoding: ?Encoding) !*String {
        var bytes = try self.data(0, false);
        if (encoding) |ec| {
            switch (ec) {
                .base64 => {
                    _ = &bytes;
                    @panic("TODO");
                },
            }
        }
        return php.createString(bytes);
    }

    pub fn copyString(self: *@This(), str: *String, encoding: ?Encoding) !void {
        _ = self;
        _ = str;
        _ = encoding;
        @panic("TODO");
    }

    pub fn getSourceAllocator(self: *const @This()) ?*const std.mem.Allocator {
        return switch (self.source) {
            .allocator => |a| a,
            .buffer => |b| b.getSourceAllocator(),
            else => null,
        };
    }

    pub fn compare(a: *const @This(), b: *const @This()) RelativePosition {
        const a_start = @intFromPtr(a.bytes.ptr);
        const a_end = a_start + a.bytes.len;
        const b_start = @intFromPtr(b.bytes.ptr);
        const b_end = b_start + b.bytes.len;
        if (a_start < b_start) {
            return if (a_end >= b_end)
                .b_inside_a
            else
                .a_before_b;
        } else if (a_start > b_start) {
            return if (a_end <= b_end)
                .a_inside_b
            else
                .b_before_a;
        } else {
            return if (a_end == b_end)
                .a_is_b
            else if (a_end <= b_end)
                .a_inside_b
            else
                .b_inside_a;
        }
    }
};

pub const BufferMap = struct {
    map: Map = .{},

    const Map = MemoryMap(*ByteBuffer, php.allocator, ByteBuffer.compare);
    const SearchResult = Map.SearchResult;

    pub fn deinit(self: *@This()) void {
        self.map.deinit();
    }

    pub fn add(self: *@This(), len: usize, alignment: std.mem.Alignment) !*ByteBuffer {
        const buf = try ByteBuffer.create(alignment);
        try buf.allocate(null, len);
        errdefer buf.release();
        try self.map.add(buf);
        try buf.clear();
        return buf;
    }

    pub fn claim(self: *@This(), bytes: []const u8) ?*ByteBuffer {
        var b: ByteBuffer = .{
            .bytes = @constCast(bytes),
            .alignment = undefined,
            .ref_count = undefined,
            .flags = undefined,
            .source = undefined,
        };
        const result = self.map.search(&b);
        return self.map.eject(result);
    }

    pub fn free(self: *@This(), bytes: []const u8) bool {
        if (self.claim(bytes)) |buf| {
            buf.release();
            return true;
        } else {
            return false;
        }
    }
};
