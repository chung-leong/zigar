pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub const NormalError = error{
    FileNotFound,
    OutOfMemory,
};

pub const PossibleError = NormalError || StrangeError;
