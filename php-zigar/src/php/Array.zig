pub const std = @import("std");

pub const Iterator = @import("./Array/Iterator.zig");
const php = @import("root.zig");
const c = php.c;
const php_al = php.allocator;
const pi = php.imports;
const String = php.String;
const unsupported = php.failure.unsupported;
const Value = php.Value;

pub fn length(self: *const @This()) usize {
    const arr = &self.impl;
    return arr.nNumOfElements;
}

pub fn nextIndex(self: *const @This()) isize {
    const arr = &self.impl;
    return switch (arr.nNextFreeElement) {
        std.math.minInt(@TypeOf(arr.nNextFreeElement)) => 0,
        else => |i| i,
    };
}

pub fn isZeroBased(self: *const @This()) bool {
    return self.nextIndex() == self.length();
}

pub fn isAssociative(self: *const @This()) bool {
    const arr = &self.impl;
    if (arr.u.flags & c.HASH_FLAG_PACKED != 0) return false;
    return for (0..arr.nNumUsed) |i| {
        const p = switch (@hasField(c.zend_array, "arData")) {
            // in newer version of PHP, the field is stored in an unnamed union
            false => arr.unnamed_0.arData[i],
            true => arr.arData[i],
        };
        if (p.val.u1.v.type != c.IS_UNDEF and p.key == null) break false;
    } else true;
}

pub fn create() *@This() {
    const arr = pi._zend_new_array_0();
    return @ptrCast(arr);
}

pub fn createNonDestructive() *@This() {
    const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(c.zend_array));
    const byte_ptr = php_al.rawAlloc(@sizeOf(c.zend_array), alignment, @returnAddress());
    const arr: *c.zend_array = @ptrCast(@alignCast(byte_ptr));
    pi._zend_hash_init(arr, c.HT_MIN_SIZE, null, false);
    return @ptrCast(arr);
}

pub fn retain(self: *@This()) *@This() {
    self.addRef();
    return self;
}

pub fn addRef(self: *@This()) void {
    self.impl.gc.refcount += 1;
}

pub fn release(self: *@This()) void {
    const arr = &self.impl;
    pi.zend_hash_release(arr);
}

pub fn subtractRef(self: *@This()) void {
    self.impl.gc.refcount -= 1;
}

pub fn has(self: *const @This(), key: anytype) bool {
    if (self.get(key)) |value| {
        value.release();
        return true;
    } else |_| {
        return false;
    }
}

pub fn get(self: *const @This(), key: anytype) !Value {
    return self.getPointer(key).*;
}

pub fn getPointer(self: *const @This(), key: anytype) !*Value {
    const arr = &self.impl;
    const zval = switch (Key.fromAny(key)) {
        .integer => |i| pi.zend_hash_index_find(arr, i),
        .string => |str| pi.zend_hash_find(arr, @ptrCast(str)),
        .slice => |slice| pi.zend_hash_str_find(arr, slice.ptr, slice.len),
    } orelse return error.Missing;
    return @ptrCast(zval);
}

pub fn set(self: *@This(), key: anytype, value: Value) void {
    const arr = &self.impl;
    const zval: *c.zval = @ptrCast(@constCast(&value));
    _ = switch (Key.fromAny(key)) {
        .integer => |i| pi.zend_hash_index_update(arr, i, zval),
        .string => |str| pi.zend_hash_update(arr, @ptrCast(str), zval),
        .slice => |slice| pi.zend_hash_str_update(arr, slice.ptr, slice.len, zval),
    };
    value.addRef();
}

pub fn delete(self: *@This(), key: anytype) void {
    _ = self.remove(key);
}

pub fn remove(self: *@This(), key: anytype) bool {
    const arr = &self.impl;
    const result = switch (Key.fromAny(key)) {
        .integer => |i| pi.zend_hash_index_del(arr, i),
        .string => |str| pi.zend_hash_del(arr, @ptrCast(str)),
        .slice => |slice| pi.zend_hash_str_del(arr, slice.ptr, slice.len),
    };
    return result == c.SUCCESS;
}

pub fn append(self: *@This(), value: Value) void {
    const arr = &self.impl;
    arr.*.u.flags |= c.HASH_FLAG_ALLOW_COW_VIOLATION;
    _ = pi.zend_hash_next_index_insert(arr, @ptrCast(@constCast(&value)));
    value.addRef();
}

pub fn iterate(self: *const @This(), options: Iterator.Options) Iterator {
    return .init(self, options);
}

pub fn toValue(self: *const @This()) Value {
    return .fromArray(self);
}

const Key = union(enum) {
    pub fn fromAny(arg: anytype) @This() {
        const KT = @TypeOf(arg);
        return switch (@typeInfo(KT)) {
            .int => |int| switch (int.signedness) {
                .signed => .{ .integer = @as(c_ulong, @bitCast(arg)) },
                .unsigned => .{ .integer = arg },
            },
            .comptime_int => .{ .integer = arg },
            .pointer => |pt| switch (pt.child) {
                String => .{ .string = @constCast(arg) },
                u8 => switch (pt.size) {
                    .slice => .{ .slice = arg },
                    .c, .many => .{ .slice = std.mem.sliceTo(arg, 0) },
                    else => unsupported(KT),
                },
                else => switch (@typeInfo(pt.child)) {
                    .array => |ar| switch (ar.child) {
                        u8 => .{ .slice = arg },
                        else => unsupported(KT),
                    },
                    else => unsupported(KT),
                },
            },
            .@"struct" => switch (KT) {
                Value => switch (arg.kind()) {
                    .string => fromAny(arg.string()),
                    .integer => fromAny(arg.integer()),
                    else => @panic("Unexpected"),
                },
                else => unsupported(KT),
            },
            else => unsupported(KT),
        };
    }

    integer: c_ulong,
    string: *String,
    slice: []const u8,
};

impl: c.zend_array,
