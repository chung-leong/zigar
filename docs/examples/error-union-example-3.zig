pub const AuthenticationError = error{
    UnknownUserNameOrPassword,
    UnverifiedAccount,
    TwoFactorFailure,
};

pub const AuthorizationError = error{
    InsufficientPriviledges,
    TemporarilySuspended,
    PermanentlyBanned,
};

pub const LoginResult = struct {
    authentication: AuthenticationError!bool,
    authorization: AuthorizationError!bool,
};

pub fn login() LoginResult {
    return .{
        .authentication = true,
        .authorization = AuthorizationError.PermanentlyBanned,
    };
}
