const std = @import("std");

const php = @import("root.zig");
const php_al = php.allocator;
const c = php.c;
const pi = php.imports;
const WithoutError = php.util.WithoutError;

pub fn report(comptime fmt: []const u8, params: anytype) error{FailureReported} {
    if (error_message) |msg| freeMessage(msg);
    error_message = std.fmt.allocPrintSentinel(php_al, fmt, params, 0) catch oom_msg;
    return error.FailureReported;
}

const oom_msg = "out of memory";
threadlocal var error_message: ?[]const u8 = null;

pub fn hasMessage() bool {
    return error_message != null;
}

pub fn clearMessage() void {
    if (error_message) |msg| {
        freeMessage(msg);
        error_message = null;
    }
}

pub fn acquireMessage(err: anytype) []const u8 {
    if (error_message) |msg| {
        error_message = null;
        return msg;
    }
    const text = errorMessage(err);
    return php_al.dupe(u8, text) catch oom_msg;
}

pub fn freeMessage(msg: []const u8) void {
    if (msg.ptr != oom_msg.ptr) php_al.free(msg);
}

pub fn errorMessage(err: anytype) [:0]const u8 {
    @setEvalBranchQuota(2000000);
    return switch (err) {
        inline else => |possible_error| get: {
            const msg = comptime decamelize: {
                const name = @errorName(possible_error);
                var buffer: [name.len * 2]u8 = undefined;
                var len: usize = 0;
                for (name, 0..) |char, i| {
                    const conversion_needed = check: {
                        var needed = false;
                        if (std.ascii.isUpper(char)) {
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
                        buffer[len] = std.ascii.toLower(char);
                        len += 1;
                    } else {
                        buffer[len] = char;
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

pub fn match(err: anytype, other_err: anytype) bool {
    const E1 = @TypeOf(err);
    const E2 = @TypeOf(other_err);
    return (E1 || E2 == E1 and err == other_err);
}

pub fn throw(err: anytype) void {
    // if an exception has already been thrown then don't do anything
    if (match(err, error.ExceptionThrown)) return;
    const msg = acquireMessage(err);
    defer freeMessage(msg);
    _ = pi.zend_throw_exception_ex(
        null,
        0,
        "%s%s%s",
        exception_prefix.ptr,
        msg.ptr,
        exception_suffix.ptr,
    );
}

pub fn inspect(value: anytype, default: WithoutError(@TypeOf(value))) WithoutError(@TypeOf(value)) {
    return switch (@typeInfo(@TypeOf(value))) {
        .error_union => if (value) |v| v else |err| throw: {
            throw(err);
            break :throw default;
        },
        else => value,
    };
}

pub fn zendResult(value: anytype) c.zend_result {
    return switch (@typeInfo(@TypeOf(value))) {
        .error_union => if (value) |_| c.SUCCESS else |_| c.FAILURE,
        .error_set => c.FAILURE,
        else => c.SUCCESS,
    };
}

pub fn notice(value: anytype) bool {
    return switch (@typeInfo(@TypeOf(value))) {
        .error_union => if (value) |_| false else |err| throw: {
            std.debug.print("Error encountered: {s}\n", .{errorMessage(err)});
            break :throw true;
        },
        else => false,
    };
}

pub fn unsupported(comptime T: type) noreturn {
    @compileError("Unexpected type: " ++ @typeName(T));
}

pub var exception_prefix: [:0]const u8 = "";
pub var exception_suffix: [:0]const u8 = "";
