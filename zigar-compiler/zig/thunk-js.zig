const std = @import("std");
const builtin = @import("builtin");
const types = @import("./types.zig");
const expect = std.testing.expect;

const Memory = types.Memory;

pub const CallResult = enum(u32) {
    ok,
    failure,
    deadlock,
    disabled,
};

pub const ThunkConstructor = *const fn (?*anyopaque, usize) anyerror!usize;

pub usingnamespace switch (builtin.target.cpu.arch) {
    .wasm32, .wasm64 => wasm,
    else => native,
};

const native = struct {
    pub const Context = struct {
        ptr: *anyopaque,
        id: usize,
    };
    const closure = @import("./closure.zig");
    const Closure = closure.Instance(Context);
    threadlocal var closure_factory = closure.Factory(Context).init();

    pub fn createThunkConstructor(comptime HostT: type, comptime FT: type, comptime _: usize) ThunkConstructor {
        const ft_ns = struct {
            fn construct(ptr: ?*anyopaque, id: usize) anyerror!usize {
                const host = HostT.init(ptr);
                const caller = createCaller(FT, Context, Closure.getContext, HostT.handleJsCall);
                const instance = try closure_factory.alloc(caller, .{
                    .ptr = host.context,
                    .id = id,
                });
                const thunk = instance.function(FT);
                return @intFromPtr(thunk);
            }
        };
        return ft_ns.construct;
    }
};
const wasm = struct {
    pub const Context = struct {
        id: usize = 0,
    };
    const count = 16;

    pub fn createThunkConstructor(comptime HostT: type, comptime FT: type, comptime slot: usize) ThunkConstructor {
        const ft_ns = struct {
            var contexts: [count]Context = init: {
                var array: [count]Context = undefined;
                for (&array) |*ptr| ptr.* = .{};
                break :init array;
            };
            const thunks: [count]*const FT = init: {
                var array: [count]*const FT = undefined;
                for (&array, 0..) |*ptr, index| {
                    const caller_ns = struct {
                        inline fn retrieveContext() Context {
                            return contexts[index];
                        }
                    };
                    ptr.* = createCaller(FT, Context, caller_ns.retrieveContext, HostT.handleJsCall);
                }
                break :init array;
            };

            fn alloc(id: usize) callconv(.C) ?*const anyopaque {
                return for (&contexts, 0..) |*ptr, index| {
                    if (ptr.id == 0) {
                        ptr.id = id;
                        break thunks[index];
                    }
                } else null;
            }

            fn free(thunk_ptr: *const anyopaque) callconv(.C) bool {
                const thunk: *const FT = @ptrCast(thunk_ptr);
                return for (thunks, 0..) |f, index| {
                    if (f == thunk) {
                        contexts[index].id = 0;
                        break true;
                    }
                } else false;
            }

            fn construct(ptr: ?*anyopaque, id: usize) !usize {
                // try to use the preallocated thunks first; if they've been used up,
                // ask the host to create a new instance of this module and get a new
                // thunk from that
                const host = HostT.init(ptr);
                const thunk_ptr = alloc(id) orelse try host.allocateJsThunk(slot);
                const thunk: *const FT = @ptrCast(thunk_ptr);
                return @intFromPtr(thunk);
            }
        };
        // export these functions so they can be called from the JS side
        @export(ft_ns.alloc, .{
            .name = std.fmt.comptimePrint("@allocFn{d}", .{slot}),
            .linkage = .strong,
        });
        @export(ft_ns.free, .{
            .name = std.fmt.comptimePrint("@freeFn{d}", .{slot}),
            .linkage = .strong,
        });
        return ft_ns.construct;
    }
};

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

fn CallHandler(comptime CT: type) type {
    return fn (CT, *anyopaque, usize, usize, bool) CallResult;
}

fn ContextRetriever(comptime CT: type) type {
    return fn () callconv(.Inline) CT;
}

fn createCaller(comptime FT: type, comptime CT: type, comptime retriever: ContextRetriever(CT), comptime handler: CallHandler(CT)) *const FT {
    const f = @typeInfo(FT).Fn;
    const PT = comptime extract: {
        var Types: [f.params.len]type = undefined;
        for (f.params, 0..) |param, index| {
            Types[index] = param.type orelse @compileError("Illegal argument type");
        }
        break :extract Types;
    };
    const RT = f.return_type orelse @compileError("Illegal return type");
    const cc = f.calling_convention;
    const ArgStruct = types.ArgumentStruct(FT);
    const ns = struct {
        fn call0() callconv(cc) RT {
            return call(retriever(), .{});
        }

        fn call1(a0: PT[0]) callconv(cc) RT {
            return call(retriever(), .{a0});
        }

        fn call2(a0: PT[0], a1: PT[1]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1 });
        }

        fn call3(a0: PT[0], a1: PT[1], a2: PT[2]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2 });
        }

        fn call4(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3 });
        }

        fn call5(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4 });
        }

        fn call6(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5 });
        }

        fn call7(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6 });
        }

        fn call8(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7 });
        }

        fn call9(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8 });
        }

        fn call10(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9 });
        }

        fn call11(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10 });
        }

        fn call12(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11 });
        }

        fn call13(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12 });
        }

        fn call14(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13 });
        }

        fn call15(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14]) callconv(cc) RT {
            return call(retriever(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14 });
        }

        fn call16(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15]) callconv(cc) RT {
            return call(retriever, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15 });
        }

        fn call(cxt: CT, args: anytype) RT {
            var arg_struct: ArgStruct = undefined;
            inline for (args, 0..) |value, index| {
                const name = std.fmt.comptimePrint("{d}", .{index});
                @field(arg_struct, name) = value;
            }
            switch (handler(cxt, &arg_struct, @sizeOf(ArgStruct), @sizeOf(RT), !isNoWait(RT))) {
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
    const caller_name = std.fmt.comptimePrint("call{d}", .{f.params.len});
    if (!@hasDecl(ns, caller_name)) {
        @compileError("Too many arguments");
    }
    return &@field(ns, caller_name);
}

test "createCaller" {
    const FT = fn (i32, f64) usize;
    const Args = types.ArgumentStruct(FT);
    const CT = struct {
        ptr: *anyopaque,
        id: usize,
    };
    const context: CT = .{
        .ptr = @ptrFromInt(0xABCD),
        .id = 1000,
    };
    const ns = struct {
        var ptr_received: ?*const anyopaque = null;
        var id_received: ?usize = null;
        var args_received: ?Args = null;
        var wait_received: ?bool = null;

        fn handleCall(ctx: CT, arg_ptr: *anyopaque, _: usize, _: usize, wait: bool) CallResult {
            ptr_received = ctx.ptr;
            id_received = ctx.id;
            const args: *Args = @ptrCast(@alignCast(arg_ptr));
            args_received = args.*;
            wait_received = wait;
            if (args.@"0" < 0) {
                return .failure;
            }
            args.retval = 999;
            return .ok;
        }

        fn retrieveContext() CT {
            return context;
        }
    };
    const f = createCaller(FT, CT, ns.retrieveContext, ns.handleCall);
    const result = f(777, 3.14);
    try expect(ns.ptr_received.? == context.ptr);
    try expect(ns.id_received.? == context.id);
    try expect(ns.args_received != null);
    try expect(ns.args_received.?.@"0" == 777);
    try expect(ns.args_received.?.@"1" == 3.14);
    try expect(result == 999);
}

test "createThunk (error handling)" {
    const CT = struct {
        ptr: *anyopaque,
        id: usize,
    };
    const context: CT = .{
        .ptr = @ptrFromInt(0xABCD),
        .id = 1000,
    };
    const ns = struct {
        fn handleCall(_: CT, _: *anyopaque, _: usize, _: usize, _: bool) CallResult {
            return .failure;
        }

        inline fn retrieveContext() CT {
            return context;
        }
    };
    const ES1 = error{ Unexpected, Cow };
    const FT1 = fn (i32, f64) ES1!usize;
    const f1 = createCaller(FT1, CT, ns.retrieveContext, ns.handleCall);
    const result1 = f1(777, 3.14);
    try expect(result1 == ES1.Unexpected);
    const ES2 = error{ unexpected, cow };
    const FT2 = fn (i32, f64) ES2!usize;
    const f2 = createCaller(FT2, CT, ns.retrieveContext, ns.handleCall);
    const result2 = f2(777, 3.14);
    try expect(result2 == ES2.unexpected);
    const FT3 = fn (i32, f64) anyerror!usize;
    const f3 = createCaller(FT3, CT, ns.retrieveContext, ns.handleCall);
    const result3 = f3(777, 3.14);
    try expect(result3 == ES2.unexpected);
}
