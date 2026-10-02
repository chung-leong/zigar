/// Opcodes supported by doOperation()
pub const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const pi = php.imports;
const Value = php.Value;

pub const @"enum" = enum(u8) {
    add = c.ZEND_ADD,
    sub = c.ZEND_SUB,
    mul = c.ZEND_MUL,
    div = c.ZEND_DIV,
    MOD = c.ZEND_MOD,
    POW = c.ZEND_POW,
    _,

    pub fn perform(self: @This(), op1: Value, op2: Value) !Value {
        var value: Value = undefined;
        const opcode = @intFromEnum(self);
        const zval1: *c.zval = @ptrCast(@constCast(&op1));
        const zval2: *c.zval = @ptrCast(@constCast(&op2));
        const zrv: *c.zval = @ptrCast(&value);
        const result = if (pi.get_unary_op(opcode)) |unary_handler|
            unary_handler(zrv, zval1)
        else if (pi.get_binary_op(opcode)) |binary_handler|
            binary_handler(zrv, zval1, zval2)
        else
            c.FAILURE;
        if (result != c.SUCCESS) return error.Failure;
        return value;
    }
};
