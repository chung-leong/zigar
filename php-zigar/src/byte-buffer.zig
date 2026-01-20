const std = @import("std");

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
        self.* = .{ .bytes = php.getStringContent(str), .alignment = alignment, .source = str };
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

    pub fn addRef(self: *@This()) void {
        self.ref_count += 1;
        // std.debug.print("#{x}.addRef {d}\n", .{ @intFromPtr(self), self.ref_count });
    }

    pub fn release(self: *@This()) void {
        self.ref_count -= 1;
        // std.debug.print("#{x}.release {d}\n", .{ @intFromPtr(self), self.ref_count });
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
