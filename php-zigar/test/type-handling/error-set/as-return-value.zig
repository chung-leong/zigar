pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub fn getError() StrangeError {
    return StrangeError.NoMoreBeer;
}

pub fn getAnyError() anyerror {
    return StrangeError.AlienInvasion;
}
