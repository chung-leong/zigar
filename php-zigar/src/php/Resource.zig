pub const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const pi = php.imports;

pub fn retain(self: *@This()) *@This() {
    self.addRef();
    return self;
}

pub fn addRef(self: *@This()) void {
    self.impl.gc.refcount += 1;
}

pub fn release(self: *@This()) void {
    const zres = &self.impl;
    _ = pi.zend_list_delete(zres);
}

pub fn subtractRef(self: *@This()) void {
    self.impl.gc.refcount -= 1;
}

impl: c.zend_resource,
