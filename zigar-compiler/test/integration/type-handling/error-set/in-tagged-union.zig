pub const TagType = enum { err, number };

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};
pub const UnionA = union(TagType) {
    err: StrangeError,
    number: i32,
};

pub var union_a: UnionA = .{ .err = StrangeError.DogAteAllMemory };
