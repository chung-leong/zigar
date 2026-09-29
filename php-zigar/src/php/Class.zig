pub const std = @import("std");

pub const Custom = @import("Class/Custom.zig").@"fn";
const php = @import("root.zig");
const c = php.c;
const deref = php.deref;
const pi = php.imports;
const String = php.String;
const Value = php.Value;

pub fn name(self: *const @This()) *String {
    return @ptrCast(self.impl.name);
}

pub fn parent(self: *const @This()) *Class {
    return @ptrCast(self.impl.unnamed_0.parent);
}

pub fn flags(self: *const @This()) Flags {
    return @bitCast(self.impl.ce_flags);
}

pub fn find(class_name: anytype) ?*@This() {
    const n = String.createFromAny(class_name);
    defer n.release();
    const zn: *c.zend_string = @ptrCast(@constCast(n));
    const zce = pi.zend_lookup_class(zn) orelse return null;
    return @ptrCast(zce);
}

pub fn builtin(ctype: Builtin) *const @This() {
    const ptr = switch (ctype) {
        .standard => deref(pi.zend_standard_class_def),
        .exception => deref(pi.zend_ce_exception),
    };
    return @ptrCast(ptr);
}

pub fn interface(itype: InterfaceId) *const @This() {
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

pub fn compareWith(self: *const @This(), other: *const @This()) c_int {
    const self_address = @intFromPtr(self);
    const other_address = @intFromPtr(other);
    return if (self_address < other_address) -1 else if (self_address > other_address) 1 else 0;
}

pub const Flags = packed struct(u32) {
    interface: bool = false, // 1 << 0
    trait: bool = false, // 1 << 1
    anonymous: bool = false, // 1 << 2
    linked: bool = false, // 1 << 3
    implicit_abstract: bool = false, // 1 << 4
    final: bool = false, // 1 << 5
    abstract: bool = false, // 1 << 6
    immutable: bool = false, // 1 << 7
    has_hints: bool = false, // 1 << 8
    top_level: bool = false, // 1 << 9
    preloaded: bool = false, // 1 << 10
    user_guards: bool = false, // 1 << 11
    constants_updated: bool = false, // 1 << 12
    no_dynamic_properties: bool = false, // 1 << 13
    has_static_in_methods: bool = false, // 1 << 14
    @"0": u1 = 0,
    reuse_get_iterator: bool = false, // 1 << 16
    resolved_parent: bool = false, // 1 << 17
    resolved_interfaces: bool = false, // 1 << 18
    unresolved_variance: bool = false, // 1 << 19
    nearly_linked: bool = false, // 1 << 20
    @"1": u1 = 0,
    cached: bool = false, // 1 << 22
    cacheable: bool = false, // 1 << 23
    has_ast_constants: bool = false, // 1 << 24
    has_ast_properties: bool = false, // 1 << 25
    has_ast_statics: bool = false, // 1 << 26
    file_cached: bool = false, // 1 << 27
    enumeration: bool = false, // 1 << 28
    not_serializable: bool = false, // 1 << 29
    @"2": u2 = 0,
};
pub const Builtin = enum {
    standard,
    exception,

    pub fn get(self: @This()) *const Class {
        return .builtin(self);
    }
};
pub const InterfaceId = enum {
    aggregate,
    array_access,
    countable,
    iterator,
    serializable,
    stringable,
    traversable,
    throwable,

    pub fn get(self: @This()) *const Class {
        return .interface(self);
    }
};
const Class = @This();

impl: c.zend_class_entry,
