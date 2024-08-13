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
                    args[i] = createAllocator(&host);
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
            const host = HostT.init(ptr, arg_ptr);
            defer host.release();
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
            const host = HostT.init(ptr, arg_ptr);
            defer host.release();
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

        pub fn release(_: @This()) void {}

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

fn createAllocator(host_ptr: anytype) std.mem.Allocator {
    const HostPtrT = @TypeOf(host_ptr);
    const VTable = struct {
        fn alloc(p: *anyopaque, size: usize, ptr_align: u8, _: usize) ?[*]u8 {
            const h: HostPtrT = @alignCast(@ptrCast(p));
            const alignment = @as(u16, 1) << @as(u4, @truncate(ptr_align));
            return if (h.allocateMemory(size, alignment)) |m| m.bytes else |_| null;
        }

        fn resize(_: *anyopaque, _: []u8, _: u8, _: usize, _: usize) bool {
            return false;
        }

        fn free(p: *anyopaque, bytes: []u8, ptr_align: u8, _: usize) void {
            const h: HostPtrT = @alignCast(@ptrCast(p));
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
        .ptr = @ptrCast(@constCast(host_ptr)),
        .vtable = &VTable.instance,
    };
}
