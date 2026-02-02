pub const Pet = enum {
    dog,
    cat,
    monkey,
};

pub fn getEnum() Pet {
    return Pet.cat;
}
