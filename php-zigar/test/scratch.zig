const std = @import("std");

const zigar = @import("zigar");

pub const Enum = enum {
    cat,
    dog,
    cow,

    pub fn @"get chicken"(self: @This()) i32 {
        _ = self;
        return 1234;
    }

    pub fn foo() i32 {
        return 0;
    }
};
