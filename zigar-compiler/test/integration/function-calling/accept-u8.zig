pub fn accept1(_: u8) void {}
pub fn accept2(_: u8, _: u8) void {}
pub fn accept3(_: u8, _: u8, _: u8) void {}
pub fn accept4(_: u8, _: u8, _: u8, _: u8) void {}

pub const Struct = struct {
    pub fn accept(_: @This(), _: u8, _: u8) void {}
};
