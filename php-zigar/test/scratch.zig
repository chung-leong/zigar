//const PrivateError = error{JustBeingEvil};

pub fn fail() !bool {
    return error.JustBeingEvil;
}
