pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};

pub const Donut = enum(u128) {
    Jelly = 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe,
    Plain = 0,
};

pub var pet: Pet = .Cat;
