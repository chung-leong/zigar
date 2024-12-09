const std = @import("std");
const builtin = @import("builtin");
const types = @import("types.zig");
const fn_transform = @import("fn-transform.zig");
const expect = std.testing.expect;

const Memory = types.Memory;

pub const ActionResult = enum(u32) {
    ok,
    failure,
    failure_deadlock,
    failure_disabled,
};
pub const ActionType = enum(u32) {
    // performed by js:
    call,
    release,
    // performed by zig:
    create,
    destroy,
    get_ptr,
    get_id,
};
pub const Error = error{ UnableToCreateThunk, UnableToFindThunk };

pub const ThunkController = *const fn (?*anyopaque, ActionType, usize) anyerror!usize;

pub usingnamespace switch (builtin.target.cpu.arch) {
    .wasm32, .wasm64 => wasm,
    else => native,
};

const native = struct {
    const binding = @import("fn-binding.zig");
    var gpa = binding.executable();

    pub fn createThunkController(comptime host: type, comptime BFT: type) ThunkController {
        const ft_ns = struct {
            fn control(ptr: ?*anyopaque, action: ActionType, arg: usize) anyerror!usize {
                const vars = .{
                    .@"-2" = ptr,
                    .@"-1" = arg,
                };
                const CHT = CallHandler(BFT);
                const Binding = binding.Binding(CHT, @TypeOf(vars));
                const caller = getJsCallHandler(host, BFT);
                switch (action) {
                    .create => {
                        if (Binding.bind(gpa.allocator(), caller, vars)) |thunk| {
                            return @intFromPtr(thunk);
                        } else |_| {
                            return Error.UnableToCreateThunk;
                        }
                    },
                    .destroy => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        if (Binding.unbind(gpa.allocator(), thunk)) |ctx| {
                            return ctx.@"-1";
                        } else {
                            return Error.UnableToFindThunk;
                        }
                    },
                    .get_ptr => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        if (Binding.fromFunction(thunk)) |b| {
                            return @intFromPtr(b.context().@"-2");
                        } else {
                            return Error.UnableToFindThunk;
                        }
                    },
                    .get_id => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        if (Binding.fromFunction(thunk)) |b| {
                            return b.context().@"-1";
                        } else {
                            return Error.UnableToFindThunk;
                        }
                    },
                    else => unreachable,
                }
            }
        };
        return &ft_ns.control;
    }

    test "createThunkController" {
        const BFT = fn (i32, f64) usize;
        const ArgStruct = types.ArgumentStruct(BFT);
        const host = struct {
            fn handleJsCall(module_ptr: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize, _: bool) ActionResult {
                if (@intFromPtr(module_ptr) == 0xdead_beef and arg_size == @sizeOf(ArgStruct)) {
                    @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = fn_id;
                    return .ok;
                } else {
                    return .failure;
                }
            }
        };
        const tc = createThunkController(host, BFT);
        const module_ptr: *anyopaque = @ptrFromInt(0xdead_beef);
        const thunk_address = try tc(module_ptr, .create, 1234);
        const thunk: *const BFT = @ptrFromInt(thunk_address);
        const result = thunk(777, 3.14);
        try expect(result == 1234);
    }
};

test {
    _ = native;
}

const wasm = struct {
    const count = 64;

    pub fn createThunkController(comptime host: type, comptime BFT: type) ThunkController {
        const tc_ns = struct {
            var fn_ids: [count]usize = init: {
                var array: [count]usize = undefined;
                for (&array) |*ptr| ptr.* = 0;
                break :init array;
            };
            const thunks: [count]*const BFT = init: {
                const CHT = CallHandler(BFT);
                const ch = @typeInfo(CHT).@"fn";
                const RT = ch.return_type.?;
                const handler = getJsCallHandler(host, BFT);
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

            fn control(_: ?*anyopaque, action: ActionType, arg: usize) !usize {
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
                    else => unreachable,
                }
            }
        };
        return &tc_ns.control;
    }

    test "createThunkController" {
        const BFT = fn (i32, f64) usize;
        const ArgStruct = types.ArgumentStruct(BFT);
        const host = struct {
            fn handleJsCall(_: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize, _: bool) ActionResult {
                if (arg_size == @sizeOf(ArgStruct)) {
                    @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = fn_id;
                    return .ok;
                } else {
                    return .failure;
                }
            }
        };
        const tc = createThunkController(host, BFT);
        const thunk_address = try tc(null, .create, 1234);
        const thunk: *const BFT = @ptrFromInt(thunk_address);
        const result = thunk(777, 3.14);
        try expect(result == 1234);
    }
};

test {
    _ = wasm;
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

fn getJsCallHandler(comptime host: type, comptime BFT: type) CallHandler(BFT) {
    const CHT = CallHandler(BFT);
    const ch = @typeInfo(CHT).@"fn";
    const RT = ch.return_type.?;
    const ns = struct {
        inline fn call(args: std.meta.ArgsTuple(CHT)) RT {
            // fill the argument struct
            const ArgStruct = types.ArgumentStruct(BFT);
            var arg_struct: ArgStruct = undefined;
            inline for (0..ch.params.len - 2) |arg_index| {
                const name = std.fmt.comptimePrint("{d}", .{arg_index});
                @field(arg_struct, name) = args[arg_index];
            }
            // the last two arguments are the context pointer and the function id
            const ctx = args[ch.params.len - 2];
            const fn_id = args[ch.params.len - 1];
            switch (host.handleJsCall(ctx, fn_id, &arg_struct, @sizeOf(ArgStruct), !isNoWait(RT))) {
                .failure_deadlock => {
                    if (comptime findError(RT, .{ error.Deadlock, error.Unexpected })) |err| {
                        return err;
                    } else @panic("Promise encountered in main thread");
                },
                .failure_disabled => {
                    if (comptime findError(RT, .{ error.Disabled, error.Unexpected })) |err| {
                        return err;
                    } else @panic("Multithreading not enabled");
                },
                .failure => {
                    if (comptime findError(RT, .{error.Unexpected})) |err| {
                        return err;
                    } else @panic("JavaScript function failed");
                },
                else => {},
            }
            return arg_struct.retval;
        }
    };
    return fn_transform.spreadArgs(ns.call, ch.calling_convention);
}

test "getJsCallHandler" {
    const BFT = fn (i32, f64) usize;
    const ArgStruct = types.ArgumentStruct(BFT);
    const host = struct {
        fn handleJsCall(_: ?*anyopaque, _: usize, arg_ptr: *anyopaque, arg_size: usize, _: bool) ActionResult {
            if (arg_size == @sizeOf(ArgStruct)) {
                @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = 1234;
                return .ok;
            } else {
                return .failure;
            }
        }
    };
    const ch = getJsCallHandler(host, BFT);
    const result = ch(777, 3.14, null, 1);
    try expect(result == 1234);
}

test "getJsCallHandler (error handling)" {
    const host = struct {
        fn init(_: ?*const anyopaque) @This() {
            return .{};
        }

        fn handleJsCall(_: ?*anyopaque, _: usize, _: *anyopaque, _: usize, _: bool) ActionResult {
            return .failure;
        }
    };
    const ES1 = error{ Unexpected, Cow };
    const BFT1 = fn (i32, f64) ES1!usize;
    const ch1 = getJsCallHandler(host, BFT1);
    const result1 = ch1(777, 3.14, null, 1);
    try expect(result1 == ES1.Unexpected);
    const ES2 = error{ Unexpected, cow };
    const BFT2 = fn (i32, f64) ES2!usize;
    const ch2 = getJsCallHandler(host, BFT2);
    const result2 = ch2(777, 3.14, null, 2);
    try expect(result2 == ES2.Unexpected);
    const BFT3 = fn (i32, f64) anyerror!usize;
    const ch3 = getJsCallHandler(host, BFT3);
    const result3 = ch3(777, 3.14, null, 3);
    try expect(result3 == ES2.Unexpected);
}

fn findError(comptime T: type, comptime errors: anytype) ?anyerror {
    switch (@typeInfo(T)) {
        .error_union => |eu| {
            inline for (errors) |err| {
                if (eu.error_set == anyerror) {
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

fn isNoWait(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .@"enum" => |en| check: {
            if (en.fields.len == 1 and en.is_exhaustive) {
                break :check std.mem.eql(u8, en.fields[0].name, "no_wait");
            } else {
                break :check false;
            }
        },
        else => false,
    };
}

test "isNoWait" {
    try expect(isNoWait(enum { no_wait }));
    try expect(!isNoWait(enum {}));
    try expect(!isNoWait(enum { no_wait, hello }));
}
