const std = @import("std");

const zigar = @import("zigar");

pub fn returnInt(promise: zigar.function.Promise(i32)) void {
    promise.resolve(1234);
}

pub fn returnInts(generator: zigar.function.Generator(?i32, false)) void {
    for ([_]i32{ 1234, 4567 }) |n| {
        if (!generator.yield(n)) {
            break;
        }
    } else generator.end();
}
