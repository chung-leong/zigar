const std = @import("std");

var cow: u32 = 123;

pub fn @"get cow"() u32 {
    return cow;
}

pub fn @"set cow"(value: u32) void {
    cow = value;
}

pub const Hello = struct {
    cat: u32,
    dog: u32,

    var something: u32 = 100;

    pub fn @"get both"(self: @This()) u32 {
        return self.cat + self.dog;
    }

    pub fn @"get something"() u32 {
        return something;
    }

    pub fn @"set something"(value: u32) void {
        something = value;
    }

    pub fn printSomething() void {
        std.debug.print("something = {d}\n", .{something});
    }
};
