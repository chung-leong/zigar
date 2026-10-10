const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const MemoryMap = @import("MemoryMap.zig").@"fn";
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const ObjectHandlers = php.ObjectHandlers;
const Object = php.Object;
const String = php.String;
const Value = php.Value;

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

pub fn getParentBuffer(self: *@This(), b: anytype, result: SearchResult) ?*ByteBuffer {
    const matching = self.map.getMatching(b, result, contains) orelse return null;
    return getObjectBuffer(matching);
}

pub fn find(self: *@This(), b: anytype) SearchResult {
    return self.map.find(b, compare);
}

pub fn free(self: *@This(), b: anytype) void {
    var result = self.map.findFirst(b, compare);
    while (self.map.get(result)) |obj| {
        const buf = getObjectBuffer(obj);
        buf.free();
        self.remove(result);
        result = self.map.findAgain(b, result, compare);
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

pub fn contains(a: *const Object, b: anytype) bool {
    const a_buf = getObjectBuffer(a);
    const b_buf = switch (@TypeOf(b)) {
        *Object, *const Object => getObjectBuffer(b),
        else => b,
    };
    return a_buf.contains(b_buf);
}

fn hasField(comptime T: type, comptime name: []const u8) bool {
    return switch (@typeInfo(T)) {
        .pointer => |pt| hasField(pt.child, name),
        else => @hasField(T, name),
    };
}

const Map = MemoryMap(*Object, php.allocator);
const SearchResult = Map.SearchResult;
const RelativePosition = Map.RelativePosition;

map: Map = .{},

pub inline fn getObjectBuffer(obj: *const Object) *ByteBuffer {
    const ptr: *const struct {
        buffer: *ByteBuffer,
        php_portion: Object,
    } = @fieldParentPtr("php_portion", obj);
    return ptr.buffer;
}
