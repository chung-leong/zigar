const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;
const expectError = std.testing.expectError;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const ArgStruct = @import("../type/arg-struct.zig").ArgStruct;
const fn_binding = @import("../zigft/fn-binding.zig");
const fn_transform = @import("../zigft/fn-transform.zig");

pub const Action = enum(u32) {
    create,
    destroy,
    identify,
};
pub const Error = error{ UnableToCreateThunk, UnableToFindThunk };

pub const ThunkController = *const fn (Action, usize) anyerror!usize;

pub fn createThunkController(comptime host: type, comptime BFT: type) ThunkController {
    const tc_ns = switch (comptime builtin.target.cpu.arch.isWasm()) {
        false => struct {
            fn control(action: Action, arg: usize) anyerror!usize {
                const vars = .{
                    .@"-1" = arg,
                };
                const CT = @TypeOf(vars);
                const caller = getJscallHandler(host, BFT);
                switch (action) {
                    .create => {
                        if (fn_binding.bind(caller, vars)) |thunk| {
                            return @intFromPtr(thunk);
                        } else |_| {
                            return Error.UnableToCreateThunk;
                        }
                    },
                    .destroy => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        if (fn_binding.bound(CT, thunk)) |ctx| {
                            defer fn_binding.unbind(thunk);
                            return ctx.@"-1";
                        } else {
                            return Error.UnableToFindThunk;
                        }
                    },
                    .identify => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        if (fn_binding.bound(CT, thunk)) |ctx| {
                            return ctx.@"-1";
                        } else {
                            return Error.UnableToFindThunk;
                        }
                    },
                }
            }
        },
        true => struct {
            const count = 16;

            var fn_ids: [count]usize = init: {
                var array: [count]usize = undefined;
                for (&array) |*ptr| ptr.* = 0;
                break :init array;
            };
            const thunks: [count]*const BFT = init: {
                const CHT = CallHandler(BFT);
                const ch = @typeInfo(CHT).@"fn";
                const RT = ch.return_type.?;
                const handler = getJscallHandler(host, BFT);
                var array: [count]*const BFT = undefined;
                for (&array, 0..) |*ptr, index| {
                    const ns = struct {
                        inline fn call(bf_args: std.meta.ArgsTuple(BFT)) RT {
                            var ch_args: std.meta.ArgsTuple(CHT) = undefined;
                            inline for (bf_args, 0..) |arg, arg_index| {
                                ch_args[arg_index] = arg;
                            }
                            ch_args[bf_args.len] = null;
                            ch_args[bf_args.len + 1] = fn_ids[index];
                            return @call(.never_inline, handler, ch_args);
                        }
                    };
                    ptr.* = &fn_transform.spreadArgs(ns.call, ch.calling_convention);
                }
                break :init array;
            };

            fn control(action: Action, arg: usize) !usize {
                switch (action) {
                    .create => {
                        const fn_id = arg;
                        return for (&fn_ids, 0..) |*ptr, index| {
                            if (ptr.* == 0) {
                                ptr.* = fn_id;
                                break @intFromPtr(thunks[index]);
                            }
                        } else Error.UnableToCreateThunk;
                    },
                    .destroy => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        return for (thunks, &fn_ids) |f, *id_ptr| {
                            if (f == thunk) {
                                defer id_ptr.* = 0;
                                break id_ptr.*;
                            }
                        } else Error.UnableToFindThunk;
                    },
                    .identify => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        return for (thunks, &fn_ids) |f, *id_ptr| {
                            if (f == thunk) {
                                break id_ptr.*;
                            }
                        } else Error.UnableToFindThunk;
                    },
                }
            }
        },
    };
    return &tc_ns.control;
}

test "createThunkController" {
    const BFT = fn (i32, f64) usize;
    const host = struct {
        fn handleJscall(fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E {
            if (arg_size == @sizeOf(ArgStruct(BFT))) {
                @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = fn_id;
                return .SUCCESS;
            } else {
                return .FAULT;
            }
        }
    };
    const tc = createThunkController(host, BFT);
    const thunk_address = try tc(.create, 1234);
    const thunk: *const BFT = @ptrFromInt(thunk_address);
    const result = thunk(777, 3.14);
    try expectEqual(1234, result);
}

fn CallHandler(comptime BFT: type) type {
    const f = @typeInfo(BFT).@"fn";
    var new_params: [f.params.len + 2]std.builtin.Type.Fn.Param = undefined;
    for (f.params, 0..) |param, index| {
        new_params[index] = param;
    }
    new_params[f.params.len] = .{
        .type = ?*anyopaque,
        .is_generic = false,
        .is_noalias = false,
    };
    new_params[f.params.len + 1] = .{
        .type = usize,
        .is_generic = false,
        .is_noalias = false,
    };
    var new_f = f;
    new_f.params = &new_params;
    return @Type(.{ .@"fn" = new_f });
}

fn getJscallHandler(comptime host: type, comptime BFT: type) CallHandler(BFT) {
    const CHT = CallHandler(BFT);
    const ch = @typeInfo(CHT).@"fn";
    const RT = ch.return_type.?;
    const ns = struct {
        inline fn call(args: std.meta.ArgsTuple(CHT)) RT {
            @setEvalBranchQuota(1000000);
            // fill the argument struct
            var arg_s: ArgStruct(BFT) = undefined;
            inline for (0..ch.params.len - 2) |arg_index| {
                const name = std.fmt.comptimePrint("{d}", .{arg_index});
                @field(arg_s, name) = args[arg_index];
            }
            // the last two arguments are the context pointer and the function id
            const fn_id = args[ch.params.len - 1];
            const result = host.handleJscall(fn_id, &arg_s, @sizeOf(@TypeOf(arg_s)));
            switch (result) {
                .SUCCESS => {},
                .DEADLK => {
                    if (comptime findError(RT, .{ error.Deadlock, error.Unexpected })) |err| {
                        return err;
                    } else @panic("Promise encountered in main thread");
                },
                .PERM => {
                    if (comptime findError(RT, .{ error.Disabled, error.Unexpected })) |err| {
                        return err;
                    } else @panic("Multithreading not enabled");
                },
                else => {
                    if (comptime findError(RT, .{error.Unexpected})) |err| {
                        return err;
                    } else @panic("JavaScript function failed");
                },
            }
            return arg_s.retval;
        }
    };
    return fn_transform.spreadArgs(ns.call, ch.calling_convention);
}

test "getJscallHandler" {
    const BFT = fn (i32, f64) usize;
    const host = struct {
        fn handleJscall(_: usize, arg_ptr: *anyopaque, arg_size: usize) E {
            if (arg_size == @sizeOf(ArgStruct(BFT))) {
                @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = 1234;
                return .SUCCESS;
            } else {
                return .FAULT;
            }
        }
    };
    const ch = getJscallHandler(host, BFT);
    const result = ch(777, 3.14, null, 1);
    try expectEqual(1234, result);
}

test "getJscallHandler (error handling)" {
    const host = struct {
        fn init(_: ?*const anyopaque) @This() {
            return .{};
        }

        fn handleJscall(_: usize, _: *anyopaque, _: usize) E {
            return .FAULT;
        }
    };
    const ES1 = error{ Unexpected, Cow };
    const BFT1 = fn (i32, f64) ES1!usize;
    const ch1 = getJscallHandler(host, BFT1);
    const result1 = ch1(777, 3.14, null, 1);
    try expectError(ES1.Unexpected, result1);
    const ES2 = error{ Unexpected, cow };
    const BFT2 = fn (i32, f64) ES2!usize;
    const ch2 = getJscallHandler(host, BFT2);
    const result2 = ch2(777, 3.14, null, 2);
    try expectError(ES2.Unexpected, result2);
    const BFT3 = fn (i32, f64) anyerror!usize;
    const ch3 = getJscallHandler(host, BFT3);
    const result3 = ch3(777, 3.14, null, 3);
    try expectError(ES2.Unexpected, result3);
}

fn findError(comptime T: type, comptime errors: anytype) ?anyerror {
    switch (@typeInfo(T)) {
        .error_union => |eu| {
            inline for (errors) |err| {
                if (@typeInfo(eu.error_set).error_set == null) {
                    return err;
                }
                const name = @errorName(err);
                if (@typeInfo(eu.error_set).error_set) |es| {
                    inline for (es) |e| {
                        if (std.mem.eql(u8, e.name, name)) return err;
                    }
                }
            }
        },
        else => {},
    }
    return null;
}

test "hasError" {
    try expect(findError(error{ Hello, World }!i32, .{error.Hello}) != null);
    try expect(findError(anyerror!i32, .{error.Cow}) != null);
    try expect(findError(error{ Hello, World }!i32, .{error.Cow}) == null);
}
