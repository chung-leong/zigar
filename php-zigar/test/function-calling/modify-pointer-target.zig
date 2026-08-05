const std = @import("std");

pub const Actor = struct {
    name: []u8,
    age: u32,
};

pub fn deage(actor: *Actor, years: u32) void {
    actor.age -= years;
}
