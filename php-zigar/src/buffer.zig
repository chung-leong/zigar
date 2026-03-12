const std = @import("std");

const findSortedIndex = @import("address-map.zig").findSortedIndex;
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
    list: std.ArrayList(*ByteBuffer) = .empty,

    pub fn init() !*@This() {
        const self = try php.allocator.create(@This());
        self.* = .{};
        return self;
    }

    pub fn deinit(self: *@This()) void {
        self.list.deinit(php.allocator);
        php.allocator.destroy(self);
    }

    pub fn add(self: *@This(), buf: *ByteBuffer) !void {
        if (buf.parent != null) return;
        const buf_address = getBufferAddress(buf);
        const index = findSortedIndex(*ByteBuffer, &self.list, buf_address, getBufferAddress);
        try self.list.insert(php.allocator, index, buf);
    }

    pub fn remove(self: *@This(), buf: *ByteBuffer) !void {
        if (buf.parent != null) return;
        const buf_address = getBufferAddress(buf);
        const index = findSortedIndex(*ByteBuffer, &self.list, buf_address, getBufferAddress);
        if (index > 0) {
            if (self.list.items[index - 1] == buf) {
                try self.list.orderedRemove(index - 1);
            }
        }
    }

    pub fn get(self: *@This(), address: usize, len: usize) !*ByteBuffer {
        const index = findSortedIndex(*ByteBuffer, &self.list, address, getBufferAddress);
        var existing_ptr: ?**ByteBuffer = null;
        if (index > 0) {
            const buf = self.list.items[index - 1];
            const buf_address = getBufferAddress(buf);
            const buf_len = buf.bytes.len;
            if (buf_address == address and buf_len == len) {
                buf.addRef();
                return buf;
            } else if (buf_address == address and buf_len < len) {
                // existing entry is within new buffer
                existing_ptr = &self.list.items[index - 1];
            } else if (buf_address <= address and address + len <= buf_address + buf_len) {
                const offset = address - buf_address;
                return try buf.slice(offset, len);
            }
        }
        const ptr: [*]u8 = @ptrFromInt(address);
        const buf = try ByteBuffer.createExternal(ptr[0..len]);
        if (existing_ptr) |buf_ptr| {
            // make existing buffer the child of this one and replace it in the list
            buf_ptr.*.parent = buf;
            buf_ptr.*.is_owner = false;
            buf_ptr.* = buf;
        } else {
            errdefer buf.release();
            try self.insert(php.allocator, index, buf);
        }
        return buf;
    }

    pub fn release(self: *@This(), buf: *ByteBuffer) void {
        if (buf.ref_count == 1) self.remove(buf);
        buf.release();
    }

    pub fn getBufferAddress(buf: *ByteBuffer) usize {
        return @intFromPtr(buf.bytes.ptr);
    }
};
