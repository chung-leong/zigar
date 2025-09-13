const std = @import("std");

pub const Error = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub var positive_outcome: Error!i32 = 123;
pub var negative_outcome: Error!i32 = error.CondomBrokeYouPregnant;

pub fn encounterBadLuck(arg: bool) !i32 {
    return if (arg) negative_outcome else positive_outcome;
}

pub var bool_error: Error!bool = error.AlienInvasion;
pub var i8_error: Error!i8 = error.SystemIsOnFire;
pub var u16_error: Error!i16 = error.NoMoreBeer;
pub var void_error: Error!void = error.DogAteAllMemory;

pub const Struct = struct {
    integer: i32,
    boolean: bool,
    decimal: f32,
};

pub var struct_error: Error!Struct = error.NoMoreBeer;
pub var struct_value: Error!Struct = .{
    .integer = 1234,
    .boolean = true,
    .decimal = 3.5,
};

const ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return T == ns and switch (decl) {
            .struct_error, .struct_value => true,
            else => false,
        };
    }
};
