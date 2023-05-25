pub const pets = enum {
    Dog,
    Cat,
    Monkey,
};

pub const donuts = enum(u128) {
    jelly = 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe,
    plain = 0,

    pub fn tasty() bool {
        return true;
    }
};
