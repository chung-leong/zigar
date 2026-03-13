const std = @import("std");

const MemoryMap = @import("memory-map.zig").MemoryMap;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const Object = php.Object;
const String = php.String;
const Value = php.Value;

pub const ByteBuffer = struct {
    bytes: []u8,
    alignment: usize = 1,
    ref_count: usize = 1,
    is_read_only: bool = false,
    is_owner: bool = false,
    source: ?*String = null,
    parent: ?*@This() = null,

    pub fn createNew(len: usize, alignment: usize) !*@This() {
        const self = try php.allocator.create(@This());
        self.* = .{
            .bytes = if (len > 0) try alloc(len, alignment) else &.{},
            .alignment = alignment,
            .is_owner = len > 0,
        };
        if (len > 0) @memset(self.bytes, 0);
        return self;
    }

    pub fn createCopy(bytes: []const u8, alignment: usize) !*@This() {
        const self = try php.allocator.create(@This());
        const len = bytes.len;
        self.* = .{
            .bytes = if (len > 0) try alloc(len, alignment) else &.{},
            .alignment = alignment,
            .is_owner = len > 0,
        };
        if (len > 0) @memcpy(self.bytes, bytes);
        return self;
    }

    pub fn createStringRef(str: *String, alignment: usize) !*@This() {
        const self = try php.allocator.create(@This());
        php.addRef(str);
        const bytes: []u8 = @constCast(php.getStringContent(str));
        self.* = .{ .bytes = bytes, .alignment = alignment, .source = str };
        return self;
    }

    pub fn createExternal(bytes: []u8) !*@This() {
        const self = try php.allocator.create(@This());
        self.* = .{
            .bytes = bytes,
        };
        return self;
    }

    pub fn slice(self: *@This(), offset: usize, len: usize) !*@This() {
        const new = try php.allocator.create(@This());
        if (offset + len > self.bytes.len) return error.OutOfBound;
        new.* = .{
            .bytes = self.bytes[offset .. offset + len],
            .parent = self,
            .is_read_only = self.is_read_only,
        };
        self.addRef();
        return new;
    }

    pub fn protect(self: *@This()) void {
        self.is_read_only = true;
    }

    pub fn copy(self: *@This(), other: *const @This()) !void {
        try self.copyBytes(other.bytes);
    }

    pub fn copyBytes(self: *@This(), bytes: []const u8) !void {
        if (self.is_read_only) return error.WriteProtected;
        if (self.bytes.len != bytes.len) return error.LengthMismatch;
        @memcpy(self.bytes, bytes);
    }

    pub fn clear(self: *@This()) void {
        @memset(self.bytes, 0);
    }

    pub fn addRef(self: *@This()) void {
        self.ref_count += 1;
    }

    pub fn release(self: *@This()) void {
        self.ref_count -= 1;
        if (self.ref_count == 0) {
            if (self.is_owner) {
                const alignment_enum = std.mem.Alignment.fromByteUnits(self.alignment);
                php.allocator.rawFree(self.bytes, alignment_enum, 0);
            } else if (self.source) |str| {
                php.release(str);
            } else if (self.parent) |buf| {
                buf.release();
            }
            php.allocator.destroy(self);
        }
    }

    fn alloc(len: usize, alignment: usize) ![]u8 {
        const alignment_enum = std.mem.Alignment.fromByteUnits(alignment);
        const ptr = php.allocator.rawAlloc(len, alignment_enum, 0) orelse return error.OutOfMemory;
        return ptr[0..len];
    }
};

pub const BufferMap = struct {
    map: MemoryMap(*ByteBuffer, php.allocator, getBufferBytes) = .{},

    pub fn init() !*@This() {
        const self = try php.allocator.create(@This());
        self.* = .{};
        return self;
    }

    pub fn deinit(self: *@This()) void {
        self.map.deinit();
        php.allocator.destroy(self);
    }

    pub fn add(self: *@This(), buf: *ByteBuffer) !void {
        if (buf.parent != null) return;
        try self.map.add(buf);
    }

    pub fn remove(self: *@This(), buf: *ByteBuffer) void {
        if (buf.parent != null) return;
        self.map.remove(buf);
    }

    pub fn get(self: *@This(), bytes: []const u8) !*ByteBuffer {
        const result = self.map.find(bytes);
        return switch (result.match_type) {
            .exact => get: {
                const buf = result.ptr.?.*;
                buf.addRef();
                break :get buf;
            },
            .larger => borrow: {
                const buf = result.ptr.?.*;
                const offset = @intFromPtr(bytes.ptr) - @intFromPtr(buf.bytes.ptr);
                break :borrow try buf.slice(offset, bytes.len);
            },
            else => |mt| create: {
                const buf = try ByteBuffer.createExternal(bytes);
                if (mt == .smaller) {
                    result.ptr.?.parent = buf;
                    result.ptr.?.is_owner = false;
                    result.ptr.?.* = buf;
                } else {
                    errdefer buf.release();
                    try self.map.insert(result, buf);
                }
                break :create buf;
            },
        };
    }

    pub fn release(self: *@This(), buf: *ByteBuffer) void {
        if (buf.ref_count == 1) self.remove(buf);
        buf.release();
    }

    pub fn getBufferBytes(buf: *ByteBuffer) []u8 {
        return buf.bytes;
    }
};
