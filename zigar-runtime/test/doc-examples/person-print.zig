// person-print.zig
const std = @import("std");

const Gender = enum { Male, Female, Other };

pub const Person = struct {
    name: []const u8,
    gender: Gender,
    age: i32,
    psycho: bool = false,

    fn print(self: Person) void {
        std.debug.print("Name: {s}\n", .{self.name});
        std.debug.print("Gender: {s}\n", .{@tagName(self.gender)});
        std.debug.print("Age: {d}\n", .{self.age});
        std.debug.print("Psycho: {s}\n", .{if (self.psycho) "Yes" else "No"});
    }
};
