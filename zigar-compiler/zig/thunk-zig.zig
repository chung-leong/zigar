const std = @import("std");
const types = @import("./types.zig");
const variadic = @import("./variadic.zig");
const expect = std.testing.expect;

const Value = types.Value;
const Memory = types.Memory;

pub fn createThunk(comptime HostT: type, comptime FT: type) types.ThunkType(FT) {
    const f = @typeInfo(FT).Fn;
    const ArgStruct = types.ArgumentStruct(FT);
    const ns_regular = struct {
        fn tryFunction(
            host: HostT,
            fn_ptr: *const anyopaque,
            arg_ptr: *anyopaque,
        ) !void {
            // extract arguments from argument struct
            const arg_struct: *ArgStruct = @ptrCast(@alignCast(arg_ptr));
            var args: std.meta.ArgsTuple(FT) = undefined;
            const fields = @typeInfo(@TypeOf(args)).Struct.fields;
            comptime var index = 0;
            inline for (fields, 0..) |field, i| {
                if (field.type == std.mem.Allocator) {
                    args[i] = createAllocator(host);
                } else {
                    const name = std.fmt.comptimePrint("{d}", .{index});
                    // get the argument only if it isn't empty
                    if (comptime @sizeOf(@TypeOf(@field(arg_struct.*, name))) > 0) {
                        args[i] = @field(arg_struct.*, name);
                    }
                    index += 1;
                }
            }
            // never inline the function so its name would show up in the trace (unless it's marked inline)
            const modifier = switch (f.calling_convention) {
                .Inline => .auto,
                else => .never_inline,
            };
            const function: *const FT = @ptrCast(fn_ptr);
            const retval = @call(modifier, function, args);
            if (comptime @TypeOf(retval) != noreturn) {
                arg_struct.retval = retval;
            }
        }

        fn invokeFunction(
            ptr: ?*anyopaque,
            fn_ptr: *const anyopaque,
            arg_ptr: *anyopaque,
        ) callconv(.C) ?Value {
            const host = HostT.init(ptr);
            tryFunction(host, fn_ptr, arg_ptr) catch |err| {
                return createErrorMessage(host, err) catch null;
            };
            return null;
        }
    };
    const ns_variadic = struct {
        fn tryFunction(
            _: HostT,
            fn_ptr: *const anyopaque,
            arg_ptr: *anyopaque,
            attr_ptr: *const anyopaque,
            arg_count: usize,
        ) !void {
            return variadic.call(FT, fn_ptr, arg_ptr, attr_ptr, arg_count);
        }

        fn invokeFunction(
            ptr: ?*anyopaque,
            fn_ptr: *const anyopaque,
            arg_ptr: *anyopaque,
            attr_ptr: *const anyopaque,
            arg_count: usize,
        ) callconv(.C) ?Value {
            const host = HostT.init(ptr);
            tryFunction(host, fn_ptr, arg_ptr, attr_ptr, arg_count) catch |err| {
                return createErrorMessage(host, err) catch null;
            };
            return null;
        }
    };
    const ns = switch (f.is_var_args) {
        false => ns_regular,
        true => ns_variadic,
    };
    return ns.invokeFunction;
}

test "createThunk" {
    const Host = struct {
        pub fn init(_: ?*anyopaque, _: *anyopaque) @This() {
            return .{};
        }

        pub fn captureString(_: @This(), _: types.Memory) !Value {
            return error.unable_to_create_object;
        }
    };
    const thunk1 = createThunk(Host, fn (i32, bool) bool);
    switch (@typeInfo(@TypeOf(thunk1))) {
        .Pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .Fn => |f| {
                    try expect(f.params.len == 3);
                    try expect(f.calling_convention == .C);
                },
                else => {
                    try expect(false);
                },
            }
        },
        else => {
            try expect(false);
        },
    }
    const thunk2 = createThunk(Host, fn (i32, bool, ...) callconv(.C) bool);
    switch (@typeInfo(@TypeOf(thunk2))) {
        .Pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .Fn => |f| {
                    try expect(f.params.len == 5);
                    try expect(f.calling_convention == .C);
                },
                else => {
                    try expect(false);
                },
            }
        },
        else => {
            try expect(false);
        },
    }
}

pub fn createErrorMessage(host: anytype, err: anyerror) !Value {
    const err_name = @errorName(err);
    const memory = Memory.from(err_name, true);
    return host.captureString(memory);
}

fn createAllocator(host: anytype) std.mem.Allocator {
    const HostT = @TypeOf(host);
    const VTable = struct {
        fn alloc(p: *anyopaque, size: usize, ptr_align: u8, _: usize) ?[*]u8 {
            const h = HostT.init(p);
            const alignment = @as(u16, 1) << @as(u4, @truncate(ptr_align));
            return if (h.allocateMemory(size, alignment)) |m| m.bytes else |_| null;
        }

        fn resize(_: *anyopaque, _: []u8, _: u8, _: usize, _: usize) bool {
            return false;
        }

        fn free(p: *anyopaque, bytes: []u8, ptr_align: u8, _: usize) void {
            const h = HostT.init(p);
            h.freeMemory(.{
                .bytes = @ptrCast(bytes.ptr),
                .len = bytes.len,
                .attributes = .{
                    .alignment = @as(u16, 1) << @as(u4, @truncate(ptr_align)),
                },
            }) catch {};
        }

        const instance: std.mem.Allocator.VTable = .{
            .alloc = alloc,
            .resize = resize,
            .free = free,
        };
    };
    return .{
        .ptr = host.context,
        .vtable = &VTable.instance,
    };
}

pub fn uninline(comptime function: anytype) types.Uninlined(@TypeOf(function)) {
    const FT = types.Uninlined(@TypeOf(function));
    if (comptime FT == @TypeOf(function)) {
        return function;
    }
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
    const ns = struct {
        fn call0() callconv(cc) RT {
            return @call(.auto, function, .{});
        }

        fn call1(a0: PT[0]) callconv(cc) RT {
            return @call(.auto, function, .{a0});
        }

        fn call2(a0: PT[0], a1: PT[1]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1 });
        }

        fn call3(a0: PT[0], a1: PT[1], a2: PT[2]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2 });
        }

        fn call4(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3 });
        }

        fn call5(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4 });
        }

        fn call6(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5 });
        }

        fn call7(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6 });
        }

        fn call8(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7 });
        }

        fn call9(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8 });
        }

        fn call10(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9 });
        }

        fn call11(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10 });
        }

        fn call12(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11 });
        }

        fn call13(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12 });
        }

        fn call14(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13 });
        }

        fn call15(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14 });
        }

        fn call16(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15]) callconv(cc) RT {
            return @call(.auto, function, .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15 });
        }
    };
    const caller_name = std.fmt.comptimePrint("call{d}", .{f.params.len});
    if (!@hasDecl(ns, caller_name)) {
        @compileError("Too many arguments");
    }
    return @field(ns, caller_name);
}
