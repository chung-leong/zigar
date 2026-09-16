pub const std = @import("std");

const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const castTo = c.castTo;
const castFrom = c.castFrom;

const String = @import("string.zig").String;
const Value = @import("value.zig").Value;

pub const Array = struct {
    pub fn length(self: *const @This()) usize {
        const ht = &self.impl;
        return ht.nNumOfElements;
    }

    pub fn nextIndex(self: *const @This()) usize {
        const ht = &self.impl;
        return ht.nNextFreeElement;
    }

    pub fn isZeroBased(self: *const @This()) bool {
        return self.nextIndex() == self.length();
    }

    pub fn create() *@This() {
        const ht = pi._zend_new_array_0();
        return castTo(@This(), ht);
    }

    pub fn createNonDestructive() *@This() {
        const bytes = pi.emalloc(@sizeOf(pd.zend_array), @src());
        const ht: *pd.zend_array = @ptrCast(@alignCast(bytes));
        pi._zend_hash_init(ht, c.HT_MIN_SIZE, null, false);
        return castTo(@This(), ht);
    }

    pub fn reuse(self: *@This()) *@This() {
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
        return if (self.get(key)) |_| true else |_| false;
    }

    pub fn get(self: *const @This(), key: anytype) !*Value {
        const ht = &self.impl;
        const zval = switch (Key.fromAny(key)) {
            .integer => |i| pi.zend_hash_index_find(ht, i),
            .string => |s| pi.zend_hash_find(ht, s),
            .slice => |s| pi.zend_hash_str_find(ht, s.ptr, s.len),
        } orelse return error.Missing;
        return castTo(Value, zval);
    }

    pub fn set(self: *@This(), key: anytype, value: *const Value) void {
        _ = self.insert(key, value);
    }

    pub fn insert(self: *@This(), key: anytype, value: *const Value) *Value {
        const ht = &self.impl;
        const zval = @constCast(castFrom(Value, value));
        const result = switch (Key.fromAny(key)) {
            .integer => |i| pi.zend_hash_index_update(ht, i, zval),
            .string => |s| pi.zend_hash_update(ht, s, zval),
            .slice => |s| pi.zend_hash_str_update(ht, s.ptr, s.len, zval),
        };
        return castTo(Value, result);
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
        return result == pd.SUCCESS;
    }

    pub fn append(self: *@This(), value: *const Value) void {
        const ht = &self.impl;
        const zval = @constCast(castFrom(Value, value));
        ht.*.u.flags |= pd.HASH_FLAG_ALLOW_COW_VIOLATION;
        _ = pi.zend_hash_next_index_insert(ht, zval);
    }

    pub fn iterate(self: *const @This(), options: Iterator.Options) Iterator {
        return .init(self, options);
    }

    pub fn toValue(self: *const @This()) Value {
        return .fromArray(self);
    }

    pub const Iterator = struct {
        ht: *pd.zend_array,
        pos: pd.HashPosition,
        options: Options,
        len: usize,
        key_value: ?Value = undefined,
        returned: bool = false,

        pub const Options = struct {
            dir: enum { forward, backward } = .forward,
        };

        pub fn init(array: *const Array, options: Options) @This() {
            var pos: pd.HashPosition = undefined;
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

        pub fn next(self: *@This()) ?*Value {
            defer self.returned = true;
            if (self.returned) {
                switch (self.options.dir) {
                    .forward => _ = pi.zend_hash_move_forward_ex(self.ht, &self.pos),
                    .backward => _ = pi.zend_hash_move_backwards_ex(self.ht, &self.pos),
                }
            }
            self.key = null;
            const zval = pi.zend_hash_get_current_data_ex(self.ht, &self.pos);
            return castTo(Value, zval);
        }

        pub fn key(self: *@This()) *Value {
            if (self.key == null) {
                var key_value: Value = undefined;
                const zval = castFrom(Value, &key_value);
                pi.zend_hash_get_current_key_zval_ex(self.ht, &zval, &self.pos);
                self.key_value = key_value;
                // don't increment the key's refcount
                if (key_value.kind() == .string) key_value.release();
            }
            return &self.key_value.?;
        }
    };
    pub const Key = union(enum) {
        integer: c_long,
        string: *String,
        slice: []const u8,

        pub fn fromAny(key: anytype) @This() {
            const KT = @TypeOf(key);
            return switch (@typeInfo(KT)) {
                .int, .comptime_int => .{ .integer = @intCast(key) },
                .pointer => |pt| switch (pt.child) {
                    String => .{ .string = @constCast(key) },
                    u8 => switch (pt.size) {
                        .slice => .{ .slice = key },
                        .c, .many => .{ .slice = std.mem.sliceTo(key, 0) },
                        else => unsupported(KT),
                    },
                    else => switch (@typeInfo(pt.child)) {
                        .array => |ar| switch (ar.child) {
                            u8 => .{ .slice = key },
                            else => unsupported(KT),
                        },
                        else => unsupported(KT),
                    },
                },
                else => unsupported(KT),
            };
        }

        fn unsupported(comptime KT: type) noreturn {
            @compileError("Unexpected type: " ++ @typeName(KT));
        }
    };

    impl: pd.zend_array,
};
