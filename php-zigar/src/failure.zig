const std = @import("std");

const php = @import("php.zig");

pub fn match(err: anyerror, other_err: anyerror) bool {
    const Error = @TypeOf(err);
    const OtherError = @TypeOf(other_err);
    return (Error || OtherError == Error and err == other_err);
}

pub fn report(comptime fmt: []const u8, params: anytype) error{Unexpected} {
    if (error_message) |msg| freeMessage(msg);
    error_message = std.fmt.allocPrintSentinel(php.allocator, fmt, params, 0) catch oom_msg;
    return error.Unexpected;
}

const oom_msg = "out of memory";
var error_message: ?[]const u8 = null;

pub fn acquireMessage(err: anytype) []const u8 {
    if (error_message) |msg| {
        error_message = null;
        return msg;
    }
    const text = getMessage(err);
    return php.allocator.dupe(u8, text) catch oom_msg;
}

pub fn freeMessage(msg: []const u8) void {
    if (msg.ptr != oom_msg.ptr) php.allocator.free(msg);
}

pub fn getMessage(err: anytype) [:0]const u8 {
    @setEvalBranchQuota(2000000);
    return switch (err) {
        inline else => |possible_error| get: {
            const msg = comptime decamelize: {
                const name = @errorName(possible_error);
                var buffer: [name.len * 2]u8 = undefined;
                var len: usize = 0;
                for (name, 0..) |c, i| {
                    const conversion_needed = check: {
                        var needed = false;
                        if (std.ascii.isUpper(c)) {
                            // previous letter is not uppercase
                            if (i == 0 or !std.ascii.isUpper(name[i - 1])) {
                                // next letter is not uppercase
                                if (i == name.len - 1 or !std.ascii.isUpper(name[i + 1])) {
                                    needed = true;
                                }
                            }
                        }
                        break :check needed;
                    };
                    if (conversion_needed) {
                        if (i > 0) {
                            buffer[len] = ' ';
                            len += 1;
                        }
                        buffer[len] = std.ascii.toLower(c);
                        len += 1;
                    } else {
                        buffer[len] = c;
                        len += 1;
                    }
                }
                buffer[len] = 0;
                len += 1;
                var array: [len]u8 = undefined;
                @memcpy(&array, buffer[0..len]);
                break :decamelize array;
            };
            break :get @ptrCast(&msg);
        },
    };
}
