const PrivateError = error{just_being_evil};

pub fn fail() !bool {
    return PrivateError.just_being_evil;
}
