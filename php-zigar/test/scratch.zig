const std = @import("std");

pub const Enum = enum { cow, pig, chicken };

pub const Error = error{ KebabIsTooSpicy, ChickenRanAway };

pub fn hello() Error!void {
    return error.KebabIsTooSpicy;
}
