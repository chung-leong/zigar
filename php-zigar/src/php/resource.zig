pub const std = @import("std");

const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;

pub const Resource = struct {
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

    impl: pd.zend_resource,
};
