const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;
const builtin = @import("builtin");

pub fn IntFor(comptime n: comptime_int) type {
    comptime var bits = 8;
    const signedness = if (n < 0) .signed else .unsigned;
    return inline while (true) : (bits *= 2) {
        const T = @Int(signedness, bits);
        if (std.math.minInt(T) <= n and n <= std.math.maxInt(T)) {
            break T;
        }
    };
}

test "IntFor" {
    try expectEqual(u8, IntFor(0));
    try expectEqual(u32, IntFor(0xFFFFFFFF));
    try expectEqual(i64, IntFor(-0xFFFFFFFF));
    try expectEqual(u8, IntFor(123));
    try expectEqual(i8, IntFor(-123));
}

pub fn FnPointerTarget(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .pointer => |pt| switch (@typeInfo(pt.child)) {
            .@"fn" => pt.child,
            else => @compileError("Not a function pointer"),
        },
        else => @compileError("Not a function pointer"),
    };
}

test "FnPointerTarget" {
    const FT = FnPointerTarget(*const fn () void);
    try expectEqual(fn () void, FT);
}

pub fn removeSentinel(comptime ptr: anytype) retval_type: {
    const PT = @TypeOf(ptr);
    const pt = @typeInfo(PT).pointer;
    const ar = @typeInfo(pt.child).array;
    const CT = [ar.len]ar.child;
    break :retval_type @Pointer(pt.size, .{
        .@"const" = pt.is_const,
        .@"volatile" = pt.is_volatile,
        .@"allowzero" = pt.is_allowzero,
        .@"addrspace" = pt.address_space,
        .@"align" = pt.alignment,
    }, CT, null);
} {
    return @ptrCast(ptr);
}

pub fn ReturnValue(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).@"fn";
    return f.return_type orelse @TypeOf(undefined);
}

test "ReturnValue" {
    const T = ReturnValue(fn () void);
    try expectEqual(void, T);
}

pub fn IteratorPayload(comptime T: type) ?type {
    return switch (@typeInfo(T)) {
        .optional => |op| switch (@typeInfo(op.child)) {
            .error_union => |eu| eu.payload,
            else => op.child,
        },
        .error_union => |eu| IteratorPayload(eu.payload),
        else => null,
    };
}

test "IteratorPayload" {
    const T1 = IteratorPayload(?i32);
    try expectEqual(i32, T1);
    const T2 = IteratorPayload(anyerror!?i32);
    try expectEqual(i32, T2);
    const T3 = IteratorPayload(i32);
    try expectEqual(null, T3);
    const T4 = IteratorPayload(anyerror!i32);
    try expectEqual(null, T4);
    const T5 = IteratorPayload(?anyerror!i32);
    try expectEqual(i32, T5);
}

pub fn hasDefaultFields(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .@"struct" => |st| inline for (st.fields) |field| {
            if (field.default_value_ptr == null) break false;
        } else true,
        else => false,
    };
}

test "hasDefaultFields" {
    const S1 = struct {
        number1: i32,
        number2: i32,
    };
    try expectEqual(false, hasDefaultFields(S1));
    const S2 = struct {
        number1: i32 = 1,
        number2: i32,
    };
    try expectEqual(false, hasDefaultFields(S2));
    const S3 = struct {
        number1: i32 = 1,
        number2: i32 = 2,
    };
    try expectEqual(true, hasDefaultFields(S3));
}

fn NextMethodReturnValue(comptime FT: type, comptime T: type) ?type {
    const f = @typeInfo(FT).@"fn";
    const arg_match = comptime check: {
        var self_count = 0;
        var alloc_count = 0;
        var struct_count = 0;
        var other_count = 0;
        for (f.params, 0..) |param, i| {
            const PT = param.type orelse break :check false;
            if (i == 0 and PT == *T) {
                self_count += 1;
            } else if (PT == std.mem.Allocator) {
                alloc_count += 1;
            } else if (hasDefaultFields(PT)) {
                struct_count += 1;
            } else {
                other_count += 1;
            }
        }
        break :check self_count == 1 and other_count == 0 and alloc_count <= 1 and struct_count <= 1;
    };
    if (arg_match) {
        if (f.return_type) |RT| {
            if (IteratorPayload(RT) != null) return RT;
        }
    }
    return null;
}

test "NextMethodReturnValue" {
    const S = struct {
        pub fn next1(_: *@This()) ?i32 {
            return null;
        }

        pub fn next2(_: *@This()) error{OutOfMemory}!?i32 {
            return null;
        }

        pub fn next3(_: *@This(), _: i32) !?i32 {
            return null;
        }

        pub fn next4(_: i32) !?i32 {
            return null;
        }

        pub fn next5(_: *@This()) i32 {
            return 0;
        }

        pub fn next6(_: *@This(), _: struct { a: i32 = 0 }) ?i32 {
            return null;
        }

        pub fn next7(_: *@This(), _: struct { a: i32 = 0, b: i32 }) ?i32 {
            return null;
        }
    };
    const T1 = NextMethodReturnValue(@TypeOf(S.next1), S);
    try expectEqual(?i32, T1);
    const T2 = NextMethodReturnValue(@TypeOf(S.next2), S);
    try expectEqual(error{OutOfMemory}!?i32, T2);
    const T3 = NextMethodReturnValue(@TypeOf(S.next3), S);
    try expectEqual(null, T3);
    const T4 = NextMethodReturnValue(@TypeOf(S.next4), S);
    try expectEqual(null, T4);
    const T5 = NextMethodReturnValue(@TypeOf(S.next5), S);
    try expectEqual(null, T5);
    const T6 = NextMethodReturnValue(@TypeOf(S.next6), S);
    try expectEqual(?i32, T6);
    const T7 = NextMethodReturnValue(@TypeOf(S.next7), S);
    try expectEqual(null, T7);
}

pub fn IteratorReturnValue(comptime T: type) ?type {
    switch (@typeInfo(T)) {
        .@"struct", .@"union", .@"opaque" => if (@hasDecl(T, "next")) {
            const next = @field(T, "next");
            return NextMethodReturnValue(@TypeOf(next), T);
        },
        .error_union => |eu| if (IteratorReturnValue(eu.payload)) |RT| {
            return switch (@typeInfo(RT)) {
                .error_union => |rt_eu| (eu.error_set || rt_eu.error_set)!rt_eu.payload,
                else => eu.error_set!RT,
            };
        },
        else => {},
    }
    return null;
}

test "IteratorReturnValue" {
    const T1 = IteratorReturnValue(std.mem.SplitIterator(u8, .sequence));
    try expect(T1 != null);
    try expectEqual([]const u8, IteratorPayload(T1.?));
    const T2 = IteratorReturnValue(error{Doh}!std.fs.path.ComponentIterator(.posix, u8));
    try expect(T2 != null);
    const T3 = IteratorReturnValue(std.fs.path);
    try expect(T3 == null);
}

pub fn isIteratorAllocating(comptime T: type) bool {
    switch (@typeInfo(T)) {
        .@"struct", .@"union", .@"opaque" => if (@hasDecl(T, "next")) {
            const next = @field(T, "next");
            const FT = @TypeOf(next);
            return inline for (@typeInfo(FT).@"fn".params) |param| {
                if (param.type == std.mem.Allocator) break true;
            } else false;
        },
        .error_union => |eu| return isIteratorAllocating(eu.payload),
        else => {},
    }
    return false;
}

test "isIteratorAllocating" {
    const result1 = isIteratorAllocating(std.mem.SplitIterator(u8, .sequence));
    try expectEqual(false, result1);
}

pub fn getInternalType(comptime OT: ?type) ?@TypeOf(.enum_literal) {
    if (OT) |T| {
        if (@typeInfo(T) == .@"struct") {
            if (@hasDecl(T, "internal_type")) return T.internal_type;
        }
    }
    return null;
}

test "getInternalType" {
    try expectEqual(.promise, getInternalType(struct {
        pub const internal_type = .promise;
    }));
}

pub fn Any(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .error_union => |eu| anyerror!eu.payload,
        else => T,
    };
}

pub fn Function(comptime arg: anytype) type {
    const AT = @TypeOf(arg);
    const FT = if (@typeInfo(AT) == .type) arg else AT;
    return switch (@typeInfo(FT)) {
        .@"fn" => FT,
        else => @compileError("Function expected, received " ++ @typeName(FT)),
    };
}

pub fn isValidCallback(comptime FT: type, comptime AT: type, comptime RT: type) bool {
    switch (@typeInfo(FT)) {
        .@"fn" => |f| {
            if (f.params.len == 2 and f.return_type == RT) {
                if (f.params[0].type != null and f.params[1].type == AT) {
                    comptime var T = f.params[0].type.?;
                    if (@typeInfo(T) == .optional) T = @typeInfo(T).optional.child;
                    if (@typeInfo(T) == .pointer and @typeInfo(T).pointer.size == .one) return true;
                }
            }
        },
        .pointer => |pt| {
            if (@typeInfo(pt.child) == .@"fn" and isValidCallback(pt.child, AT, RT)) {
                return true;
            }
        },
        else => {},
    }
    return false;
}

test "isValidCallback" {
    try expectEqual(false, isValidCallback(void, u32, void));
    try expectEqual(false, isValidCallback(*anyopaque, u32, void));
    try expectEqual(true, isValidCallback(*fn (*anyopaque, u32) void, u32, void));
    try expectEqual(true, isValidCallback(*fn (?*anyopaque, u32) void, u32, void));
    try expectEqual(false, isValidCallback(*fn (*anyopaque, u32) bool, u32, void));
    try expectEqual(true, isValidCallback(*fn (*usize, u32) void, u32, void));
    try expectEqual(false, isValidCallback(*fn (*usize, u32) i32, u32, void));
    try expectEqual(false, isValidCallback(*fn ([*]usize, u32) void, u32, void));
    try expectEqual(false, isValidCallback(**fn (*usize, u32) void, u32, void));
}

pub fn getCallback(comptime FT: type, cb: anytype) *const FT {
    const CBT = @TypeOf(cb);
    const f = @typeInfo(FT).@"fn";
    if (comptime !isValidCallback(CBT, f.params[1].type.?, f.return_type.?)) {
        @compileError("Expecting " ++ @typeName(FT) ++ ", received: " ++ @typeName(CBT));
    }
    const fn_ptr = switch (@typeInfo(CBT)) {
        .pointer => cb,
        .@"fn" => &cb,
        else => unreachable,
    };
    return @ptrCast(fn_ptr);
}

test "getCallback" {
    const ns = struct {
        fn hello(_: *const u32, _: i32) void {}
    };
    const cb = getCallback(fn (?*anyopaque, i32) void, ns.hello);
    try expectEqual(@intFromPtr(&ns.hello), @intFromPtr(cb));
}
