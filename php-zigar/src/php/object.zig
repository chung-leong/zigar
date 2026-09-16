pub const std = @import("std");

const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const deref = c.deref;

const Value = @import("value.zig").Value;

pub const Object = struct {
    pub fn reuse(self: *@This()) *@This() {
        self.addRef();
        return self;
    }

    pub fn addRef(self: *@This()) void {
        self.impl.gc.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        const zobj = &self.impl;
        pi.zend_object_release(zobj);
    }

    pub fn subtractRef(self: *@This()) void {
        self.impl.gc.refcount -= 1;
    }

    pub fn toValue(self: *const @This()) Value {
        return .fromObject(self);
    }

    pub fn standardHandlers() *const Handlers {
        return deref(&pi.std_object_handlers);
    }

    pub const Handlers = c.zend_object_handlers;

    impl: pd.zend_object,
};
