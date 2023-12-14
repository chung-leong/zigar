pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};

pub fn getEnum() Pet {
    return Pet.Cat;
}
