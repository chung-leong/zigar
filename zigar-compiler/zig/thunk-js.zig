const std = @import("std");
const builtin = @import("builtin");
const types = @import("types.zig");
const fn_transform = @import("fn-transform.zig");
const expect = std.testing.expect;

const Memory = types.Memory;

pub const CallResult = enum(u32) {
    ok,
    failure,
    deadlock,
    disabled,
};
pub const Action = enum(u32) {
    create,
    destroy,
};
pub const Error = error{ unable_to_create_thunk, unable_to_find_thunk };

pub const ThunkController = *const fn (?*anyopaque, Action, usize) anyerror!usize;

pub usingnamespace switch (builtin.target.cpu.arch) {
    .wasm32, .wasm64 => wasm,
    else => native,
};

const native = struct {
    const binding = @import("fn-binding.zig");
    var gpa = binding.executable();

    pub fn createThunkController(comptime HostT: type, comptime BFT: type) ThunkController {
        const ft_ns = struct {
            fn control(ptr: ?*anyopaque, action: Action, arg: usize) anyerror!usize {
                const vars = .{
                    .@"-2" = ptr,
                    .@"-1" = arg,
                };
                const CHT = CallHandler(BFT);
                const Binding = binding.Binding(CHT, @TypeOf(vars));
                const caller = getJsCallHandler(HostT, BFT);

                switch (action) {
                    .create => {
                        if (Binding.bind(gpa.allocator(), caller, vars)) |thunk| {
                            return @intFromPtr(thunk);
                        } else |_| {
                            return Error.unable_to_create_thunk;
                        }
                    },
                    .destroy => {
                        const thunk: *const BFT = @ptrFromInt(arg);
                        Binding.unbind(gpa.allocator(), thunk);
                        return 0;
                    },
                }
            }
        };
        return ft_ns.control;
    }

    test "createThunkController" {
        const BFT = fn (i32, f64) usize;
        const ArgStruct = types.ArgumentStruct(BFT);
        const Host = struct {
            context: *anyopaque,

            fn init(ctx: ?*anyopaque) @This() {
                return .{ .context = ctx.? };
            }

            fn handleJsCall(self: @This(), fn_id: usize, arg_ptr: ?*anyopaque, arg_size: usize, _: usize, _: bool) CallResult {
                if (@intFromPtr(self.context) == 0xdead_beef and arg_size == @sizeOf(ArgStruct)) {
                    @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = fn_id;
                    return .ok;
                } else {
                    return .failure;
                }
            }
        };
        const tc = createThunkController(Host, BFT);
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

    pub fn createThunkController(comptime HostT: type, comptime BFT: type) ThunkController {
        const tc_ns = struct {
            var fn_ids: [count]usize = init: {
                var array: [count]usize = undefined;
                for (&array) |*ptr| ptr.* = 0;
                break :init array;
            };
            const thunks: [count]*const BFT = init: {
                const CHT = CallHandler(BFT);
                const ch = @typeInfo(CHT).Fn;
                const RT = ch.return_type.?;
                const handler = getJsCallHandler(HostT, BFT);
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

            fn alloc(id: usize) callconv(.C) ?*const anyopaque {
                return for (&fn_ids, 0..) |*ptr, index| {
                    if (ptr.* == 0) {
                        ptr.* = id;
                        break thunks[index];
                    }
                } else null;
            }

            fn free(thunk_ptr: *const anyopaque) callconv(.C) bool {
                const thunk: *const BFT = @ptrCast(thunk_ptr);
                return for (thunks, &fn_ids) |f, *id_ptr| {
                    if (f == thunk) {
                        id_ptr.* = 0;
                        break true;
                    }
                } else false;
            }

            fn control(_: ?*anyopaque, action: Action, arg: usize) !usize {
                switch (action) {
                    .create => {
                        if (alloc(arg)) |thunk_ptr| {
                            return @intFromPtr(thunk_ptr);
                        } else {
                            return Error.unable_to_create_thunk;
                        }
                    },
                    .destroy => {
                        if (free(@ptrFromInt(arg))) {
                            return 0;
                        } else {
                            return Error.unable_to_find_thunk;
                        }
                    },
                }
            }
        };
        return tc_ns.control;
    }

    test "createThunkController" {
        const BFT = fn (i32, f64) usize;
        const ArgStruct = types.ArgumentStruct(BFT);
        const Host = struct {
            fn init(_: ?*anyopaque) @This() {
                return .{};
            }

            fn handleJsCall(_: @This(), fn_id: usize, arg_ptr: ?*anyopaque, arg_size: usize, _: usize, _: bool) CallResult {
                if (arg_size == @sizeOf(ArgStruct)) {
                    @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = fn_id;
                    return .ok;
                } else {
                    return .failure;
                }
            }
        };
        const tc = createThunkController(Host, BFT);
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
    const f = @typeInfo(BFT).Fn;
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
    return @Type(.{ .Fn = new_f });
}

fn getJsCallHandler(comptime HostT: type, comptime BFT: type) CallHandler(BFT) {
    const CHT = CallHandler(BFT);
    const ch = @typeInfo(CHT).Fn;
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
            const host = HostT.init(ctx);
            switch (host.handleJsCall(fn_id, &arg_struct, @sizeOf(ArgStruct), @sizeOf(RT), !isNoWait(RT))) {
                .deadlock => @panic("Promise encountered in main thread"),
                .disabled => @panic("Multithreading not enabled"),
                .failure => {
                    if (comptime hasError(RT, "unexpected")) {
                        return error.unexpected;
                    } else if (comptime hasError(RT, "Unexpected")) {
                        return error.Unexpected;
                    } else {
                        @panic("JavaScript function failed");
                    }
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
    const Host = struct {
        fn init(_: ?*const anyopaque) @This() {
            return .{};
        }

        fn handleJsCall(_: @This(), _: usize, arg_ptr: ?*anyopaque, arg_size: usize, _: usize, _: bool) CallResult {
            if (arg_size == @sizeOf(ArgStruct)) {
                @as(*ArgStruct, @ptrCast(@alignCast(arg_ptr))).retval = 1234;
                return .ok;
            } else {
                return .failure;
            }
        }
    };
    const ch = getJsCallHandler(Host, BFT);
    const result = ch(777, 3.14, null, 1);
    try expect(result == 1234);
}

test "getJsCallHandler (error handling)" {
    const Host = struct {
        fn init(_: ?*const anyopaque) @This() {
            return .{};
        }

        fn handleJsCall(_: @This(), _: usize, _: ?*anyopaque, _: usize, _: usize, _: bool) CallResult {
            return .failure;
        }
    };
    const ES1 = error{ Unexpected, Cow };
    const BFT1 = fn (i32, f64) ES1!usize;
    const ch1 = getJsCallHandler(Host, BFT1);
    const result1 = ch1(777, 3.14, null, 1);
    try expect(result1 == ES1.Unexpected);
    const ES2 = error{ unexpected, cow };
    const BFT2 = fn (i32, f64) ES2!usize;
    const ch2 = getJsCallHandler(Host, BFT2);
    const result2 = ch2(777, 3.14, null, 2);
    try expect(result2 == ES2.unexpected);
    const BFT3 = fn (i32, f64) anyerror!usize;
    const ch3 = getJsCallHandler(Host, BFT3);
    const result3 = ch3(777, 3.14, null, 3);
    try expect(result3 == ES2.unexpected);
}

fn hasError(comptime T: type, comptime name: []const u8) bool {
    return switch (@typeInfo(T)) {
        .ErrorUnion => |eu| check: {
            if (@typeInfo(eu.error_set).ErrorSet) |errors| {
                inline for (errors) |err| {
                    if (std.mem.eql(u8, err.name, name)) {
                        break :check true;
                    }
                } else {
                    break :check false;
                }
            } else {
                break :check true;
            }
        },
        else => false,
    };
}

test "hasError" {
    try expect(hasError(error{ hello, world }!i32, "hello"));
    try expect(hasError(anyerror!i32, "cow"));
    try expect(!hasError(error{ hello, world }!i32, "cow"));
}

fn isNoWait(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Enum => |en| check: {
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
