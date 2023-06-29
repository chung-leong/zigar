pub const Error = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub fn returnNumber(arg: i32) !i32 {
    if (arg > 0) {
        return arg;
    } else {
        return Error.SystemIsOnFire;
    }
}
