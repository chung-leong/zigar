const std = @import("std");
const zigar = @import("zigar");

pub fn spawn(_: zigar.function.Promise(i32)) !void {
    return error.ThreadCreationFailure;
}
