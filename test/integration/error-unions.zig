pub const Error = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub var positive_outcome: Error!i32 = 123;
pub var negative_outcome: Error!i32 = Error.CondomBrokeYouPregnant;

pub fn encounterBadLuck(arg: bool) !i32 {
    return if (arg) negative_outcome else positive_outcome;
}

pub var bool_error: Error!bool = Error.AlienInvasion;
pub var i8_error: Error!i8 = Error.SystemIsOnFire;
pub var u16_error: Error!i16 = Error.NoMoreBeer;
pub var void_error: Error!void = Error.DogAteAllMemory;
