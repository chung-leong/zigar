const std = @import("std");

pub fn all(v: @Vector(4, bool)) bool {
    return @reduce(.And, v);
}

pub fn any(v: @Vector(4, bool)) bool {
    return @reduce(.Or, v);
}
