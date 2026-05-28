const std = @import("std");

pub const FileOpenError = error{
    AccessDenied,
    OutOfMemory,
    FileNotFound,
};

pub const HumanError = error{
    GotIntoCryptoCurrencies,
    RanOutOfBeer,
    DidNotKnowHowToUseACondom,
    HungOutWithCliffordBanes,
};

pub const AnyError = anyerror;
