pub const std = @import("std");

const php = @import("../root.zig");
const Array = php.Array;
const c = php.c;
const pi = php.imports;
const Value = php.Value;

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
        .array = ht,
        .position = pos,
        .len = ht.nNumOfElements,
        .options = options,
    };
}

pub fn reset(self: *@This()) void {
    switch (self.options.dir) {
        .forward => pi.zend_hash_internal_pointer_reset_ex(self.array, &self.position),
        .backward => pi.zend_hash_internal_pointer_end_ex(self.array, &self.position),
    }
    self.returned = false;
}

pub fn next(self: *@This()) ?Value {
    defer self.returned = true;
    if (self.returned) {
        switch (self.options.dir) {
            .forward => _ = pi.zend_hash_move_forward_ex(self.array, &self.position),
            .backward => _ = pi.zend_hash_move_backwards_ex(self.array, &self.position),
        }
    }
    self.key_value = null;
    const zval = pi.zend_hash_get_current_data_ex(self.array, &self.position) orelse return null;
    return @as(*const Value, @ptrCast(zval)).*;
}

pub fn key(self: *@This()) Value {
    if (self.key_value == null) {
        var key_value: Value = undefined;
        pi.zend_hash_get_current_key_zval_ex(self.array, @ptrCast(&key_value), &self.position);
        self.key_value = key_value;
        // don't increment the key's refcount
        if (key_value.kind() == .string) key_value.release();
    }
    return self.key_value.?;
}

array: *c.zend_array,
position: c.HashPosition,
options: Options,
len: usize,
key_value: ?Value = undefined,
returned: bool = false,
