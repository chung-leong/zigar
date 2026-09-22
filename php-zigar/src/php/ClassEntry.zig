pub const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const deref = php.deref;
const pi = php.imports;
const String = php.String;
const Value = php.Value;

pub fn find(name: anytype) ?*@This() {
    const n = String.createFromAny(name);
    defer n.release();
    const zn: *c.zend_string = @ptrCast(@constCast(n));
    const zce = pi.zend_lookup_class(zn) orelse return null;
    return @ptrCast(zce);
}

pub fn getStandardClass(ctype: StandardClass) *const @This() {
    const ptr = switch (ctype) {
        .standard => deref(pi.zend_standard_class_def),
        .exception => deref(pi.zend_ce_exception),
    };
    return @ptrCast(ptr);
}

pub fn getStandardInterface(itype: StandardInterface) *const @This() {
    const ptr = switch (itype) {
        .aggregate => deref(pi.zend_ce_aggregate),
        .array_access => deref(pi.zend_ce_arrayaccess),
        .countable => deref(pi.zend_ce_countable),
        .iterator => deref(pi.zend_ce_iterator),
        .serializable => deref(pi.zend_ce_serializable),
        .stringable => deref(pi.zend_ce_stringable),
        .traversable => deref(pi.zend_ce_traversable),
        .throwable => deref(pi.zend_ce_throwable),
    };
    return @ptrCast(ptr);
}

pub const StandardClass = enum {
    standard,
    exception,

    pub fn get(self: @This()) *const ClassEntry {
        return .getStandardClass(self);
    }
};
pub const StandardInterface = enum {
    aggregate,
    array_access,
    countable,
    iterator,
    serializable,
    stringable,
    traversable,
    throwable,

    pub fn get(self: @This()) *const ClassEntry {
        return .getStandardInterface(self);
    }
};
const ClassEntry = @This();

impl: c.zend_class_entry,
