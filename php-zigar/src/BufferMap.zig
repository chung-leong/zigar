const std = @import("std");
const builtin = @import("builtin");

const ByteBuffer = @import("ByteBuffer.zig");
const MemoryMap = @import("MemoryMap.zig").@"fn";
const php_ng = @import("php/root.zig");
const String = php_ng.String;
const php_al = php_ng.allocator;

pub fn deinit(self: *@This()) void {
    for (self.map.list.items) |buf| buf.release();
    self.map.deinit();
}

pub fn find(self: *@This(), b: anytype) SearchResult {
    return self.map.find(b, ByteBuffer.compare);
}

pub fn get(self: *@This(), result: SearchResult) ?*ByteBuffer {
    return self.map.get(result);
}

pub fn getParentBuffer(self: *@This(), b: anytype, result: SearchResult) ?*ByteBuffer {
    return self.map.getMatching(b, result, ByteBuffer.contains);
}

pub fn insert(self: *@This(), result: SearchResult, buffer: *ByteBuffer) !void {
    return try self.map.insert(result, buffer);
}

pub fn remove(self: *@This(), result: SearchResult) void {
    return self.map.remove(result);
}

pub fn clear(self: *@This()) void {
    const buffers = self.map.items();
    for (buffers) |buf| buf.release();
}

const Map = MemoryMap(*ByteBuffer, php_al);
const SearchResult = Map.SearchResult;

map: Map = .{},
