pub const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const pi = php.imports;
const String = php.String;
const unsupported = php.failure.unsupported;
const Value = php.Value;

pub const Array = struct {
    pub fn length(self: *const @This()) usize {
        const ht = &self.impl;
        return ht.nNumOfElements;
    }

    pub fn nextIndex(self: *const @This()) isize {
        const ht = &self.impl;
        return switch (ht.nNextFreeElement) {
            std.math.minInt(@TypeOf(ht.nNextFreeElement)) => 0,
            else => |i| i,
        };
    }

    pub fn isZeroBased(self: *const @This()) bool {
        return self.nextIndex() == self.length();
    }

    pub fn isAssociative(self: *const @This()) bool {
        const ht = &self.impl;
        if (ht.u.flags & c.HASH_FLAG_PACKED != 0) return false;
        return for (0..ht.nNumUsed) |i| {
            const p = switch (@hasField(c.zend_array, "arData")) {
                // in newer version of PHP, the field is stored in an unnamed union
                false => ht.unnamed_0.arData[i],
                true => ht.arData[i],
            };
            if (p.val.u1.v.type != c.IS_UNDEF and p.key == null) break false;
        } else true;
    }

    pub fn create() *@This() {
        const ht = pi._zend_new_array_0();
        return @ptrCast(ht);
    }

    pub fn createNonDestructive() *@This() {
        const bytes = pi.emalloc(@sizeOf(c.zend_array), @src());
        const ht: *c.zend_array = @ptrCast(@alignCast(bytes));
        pi._zend_hash_init(ht, c.HT_MIN_SIZE, null, false);
        return @ptrCast(ht);
    }

    pub fn retain(self: *@This()) *@This() {
        self.addRef();
        return self;
    }

    pub fn addRef(self: *@This()) void {
        self.impl.gc.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        const ht = &self.impl;
        pi.zend_hash_release(ht);
    }

    pub fn subtractRef(self: *@This()) void {
        self.impl.gc.refcount -= 1;
    }

    pub fn has(self: *const @This(), key: anytype) bool {
        if (self.get(key)) |value| {
            value.release();
            return true;
        } else {
            return false;
        }
    }

    pub fn get(self: *const @This(), key: anytype) !Value {
        const ht = &self.impl;
        const zval = switch (Key.fromAny(key)) {
            .integer => |i| pi.zend_hash_index_find(ht, i),
            .string => |s| pi.zend_hash_find(ht, s),
            .slice => |s| pi.zend_hash_str_find(ht, s.ptr, s.len),
        } orelse return error.Missing;
        return @ptrCast(zval);
    }

    pub fn set(self: *@This(), key: anytype, value: Value) void {
        const ht = &self.impl;
        const zval: *c.zval = @ptrCast(@constCast(&value));
        _ = switch (Key.fromAny(key)) {
            .integer => |i| pi.zend_hash_index_update(ht, i, zval),
            .string => |str| pi.zend_hash_update(ht, @ptrCast(str), zval),
            .slice => |slice| pi.zend_hash_str_update(ht, slice.ptr, slice.len, zval),
        };
        value.addRef();
    }

    pub fn delete(self: *@This(), key: anytype) void {
        _ = self.remove(key);
    }

    pub fn remove(self: *@This(), key: anytype) bool {
        const ht = &self.impl;
        const result = switch (Key.fromAny(key)) {
            .integer => |i| pi.zend_hash_index_del(ht, i),
            .string => |s| pi.zend_hash_del(ht, s),
            .slice => |s| pi.zend_hash_str_del(ht, s.ptr, s.len),
        };
        return result == c.SUCCESS;
    }

    pub fn append(self: *@This(), value: *const Value) void {
        const ht = &self.impl;
        ht.*.u.flags |= c.HASH_FLAG_ALLOW_COW_VIOLATION;
        _ = pi.zend_hash_next_index_insert(ht, @ptrCast(value));
        value.addRef();
    }

    pub fn iterate(self: *const @This(), options: Iterator.Options) Iterator {
        return .init(self, options);
    }

    pub fn toValue(self: *const @This()) Value {
        return .fromArray(self);
    }

    pub const Iterator = struct {
        ht: *c.zend_array,
        pos: c.HashPosition,
        options: Options,
        len: usize,
        key_value: ?Value = undefined,
        returned: bool = false,

        pub const Options = struct {
            dir: enum { forward, backward } = .forward,
        };

        pub fn init(array: *const Array, options: Options) @This() {
            var pos: c.HashPosition = undefined;
            const ht = @constCast(&array.impl);
            switch (options.dir) {
                .forward => pi.zend_hash_internal_pointer_reset_ex(ht, &pos),
                .backward => pi.zend_hash_internal_pointer_end_ex(ht, &pos),
            }
            return .{
                .ht = ht,
                .pos = pos,
                .len = ht.nNumOfElements,
                .options = options,
            };
        }

        pub fn reset(self: *@This()) void {
            switch (self.options.dir) {
                .forward => pi.zend_hash_internal_pointer_reset_ex(self.ht, &self.pos),
                .backward => pi.zend_hash_internal_pointer_end_ex(self.ht, &self.pos),
            }
            self.returned = false;
        }

        pub fn next(self: *@This()) ?Value {
            defer self.returned = true;
            if (self.returned) {
                switch (self.options.dir) {
                    .forward => _ = pi.zend_hash_move_forward_ex(self.ht, &self.pos),
                    .backward => _ = pi.zend_hash_move_backwards_ex(self.ht, &self.pos),
                }
            }
            self.key_value = null;
            const zval = pi.zend_hash_get_current_data_ex(self.ht, &self.pos) orelse return null;
            return @as(*const Value, @ptrCast(zval)).*;
        }

        pub fn key(self: *@This()) Value {
            if (self.key_value == null) {
                var key_value: Value = undefined;
                pi.zend_hash_get_current_key_zval_ex(self.ht, @ptrCast(&key_value), &self.pos);
                self.key_value = key_value;
                // don't increment the key's refcount
                if (key_value.kind() == .string) key_value.release();
            }
            return self.key_value.?;
        }
    };
    const Key = union(enum) {
        pub fn fromAny(arg: anytype) @This() {
            const KT = @TypeOf(arg);
            return switch (@typeInfo(KT)) {
                .int => |int| switch (int.signedness) {
                    .signed => @bitCast(@as(c_long, arg)),
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
                else => unsupported(KT),
            };
        }

        integer: c_ulong,
        string: *String,
        slice: []const u8,
    };

    impl: c.zend_array,
};
