const PrivateError = error{just_being_evil};

pub fn fail() anyerror!bool {
    return PrivateError.just_being_evil;
}
