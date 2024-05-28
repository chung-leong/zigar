pub const StructA = packed struct(u32) {
    apple: bool = false,
    banana: bool = false,
    cantaloupe: bool = false,
    durian: bool = false,
    _: u28 = 0,
};

pub const StructB = packed struct(u64) {
    agnieszka: bool = false,
    basia: bool = false,
    celina: bool = false,
    dagmara: bool = false,
    _: u60 = 0,
};
