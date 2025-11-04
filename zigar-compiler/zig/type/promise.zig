const std = @import("std");
const expectEqual = std.testing.expectEqual;
const expectError = std.testing.expectError;

const util = @import("util.zig");

pub fn Promise(comptime T: type) type {
    return struct {
        ptr: ?*anyopaque = null,
        callback: *const fn (?*anyopaque, T) void,

        pub const payload = T;
        pub const internal_type = .promise;

        pub fn init(ptr: ?*const anyopaque, cb: anytype) @This() {
            return .{
                .ptr = @constCast(ptr),
                .callback = util.getCallback(fn (?*anyopaque, T) void, cb),
            };
        }

        pub fn resolve(self: @This(), value: T) void {
            self.callback(self.ptr, value);
        }

        pub fn any(self: @This()) Promise(util.Any(T)) {
            return .{ .ptr = self.ptr, .callback = @ptrCast(self.callback) };
        }

        pub fn partition(self: @This(), allocator: std.mem.Allocator, count: usize) !@This() {
            if (count == 1) {
                return self;
            }
            const ThisPromise = @This();
            const Context = struct {
                allocator: std.mem.Allocator,
                promise: ThisPromise,
                count: usize,
                fired: bool = false,

                pub fn resolve(ctx: *@This(), value: T) void {
                    var call = false;
                    var free = false;
                    if (@typeInfo(T) == .error_union) {
                        if (value) |_| {
                            free = @atomicRmw(usize, &ctx.count, .Sub, 1, .acq_rel) == 1;
                            call = free and @cmpxchgStrong(bool, &ctx.fired, false, true, .acq_rel, .monotonic) == null;
                        } else |_| {
                            call = @cmpxchgStrong(bool, &ctx.fired, false, true, .acq_rel, .monotonic) == null;
                            free = @atomicRmw(usize, &ctx.count, .Sub, 1, .acq_rel) == 1;
                        }
                    } else {
                        free = @atomicRmw(usize, &ctx.count, .Sub, 1, .acq_rel) == 1;
                        call = free;
                    }
                    if (call) {
                        ctx.promise.resolve(value);
                    }
                    if (free) {
                        const allocator_copy = ctx.allocator;
                        allocator_copy.destroy(ctx);
                    }
                }
            };
            const ctx = try allocator.create(Context);
            ctx.* = .{ .allocator = allocator, .promise = self, .count = count };
            return @This().init(ctx, Context.resolve);
        }

        test "partition" {
            if (T == anyerror!u32) {
                const ns = struct {
                    var test_value: T = 0;

                    fn resolve(_: *anyopaque, value: T) void {
                        test_value = value;
                    }
                };
                var gpa = std.heap.GeneralPurposeAllocator(.{}){};
                const promise1: @This() = @This().init(null, ns.resolve);
                const multipart_promise1 = try promise1.partition(gpa.allocator(), 3);
                multipart_promise1.resolve(1);
                multipart_promise1.resolve(2);
                try expectEqual(0, ns.test_value);
                multipart_promise1.resolve(3);
                try expectEqual(3, ns.test_value);
                const promise2: @This() = @This().init(null, ns.resolve);
                const multipart_promise2 = try promise2.partition(gpa.allocator(), 3);
                multipart_promise2.resolve(error.OutOfMemory);
                try expectError(error.OutOfMemory, ns.test_value);
            }
        }
    };
}

test {
    _ = Promise(anyerror!u32);
}

pub fn PromiseOf(comptime arg: anytype) type {
    const FT = util.Function(arg);
    const f = @typeInfo(FT).@"fn";
    return Promise(f.return_type.?);
}

pub fn PromiseArgOf(comptime arg: anytype) type {
    const FT = util.Function(arg);
    const f = @typeInfo(FT).@"fn";
    return inline for (f.params) |param| {
        if (util.getInternalType(param.type) == .promise) break param.type.?;
    } else @compileError("No promise argument: " ++ @typeName(FT));
}
