const std = @import("std");
const expectEqual = std.testing.expectEqual;
const expectError = std.testing.expectError;

const util = @import("util.zig");

pub fn Generator(comptime T: type, comptime need_allocator: bool) type {
    if (util.IteratorPayload(T) == null) {
        @compileError("Expecting optional type, received: " ++ @typeName(T));
    }
    return if (need_allocator)
        struct {
            allocator: std.mem.Allocator,
            ptr: ?*anyopaque = null,
            callback: *const fn (allocator: std.mem.Allocator, ?*anyopaque, T) bool,

            pub const payload = T;
            pub const internal_type = .generator;

            pub fn init(allocator: std.mem.Allocator, ptr: ?*const anyopaque, cb: anytype) @This() {
                return .{
                    .allocator = allocator,
                    .ptr = @constCast(ptr),
                    .callback = util.getCallback(fn (?*anyopaque, T) bool, cb),
                };
            }

            pub fn yield(self: @This(), value: T) bool {
                return self.callback(self.allocator, self.ptr, value);
            }

            pub fn end(self: anytype) void {
                _ = self.yield(null);
            }

            pub fn pipe(self: anytype, arg: anytype) void {
                const AT = @TypeOf(arg);
                if (util.IteratorReturnValue(AT) == null) {
                    @compileError("Expecting an iterator, received: " ++ @typeName(AT));
                }
                var iter = switch (@typeInfo(AT)) {
                    .error_union => arg catch |err| {
                        _ = self.yield(err);
                        return;
                    },
                    else => arg,
                };
                defer if (@hasDecl(@TypeOf(iter), "deinit")) iter.deinit();
                while (true) {
                    const result = iter.next(self.allocator);
                    // break if callback returns false
                    if (!self.yield(result)) break;
                    // break if result is an error or null
                    switch (@typeInfo(@TypeOf(result))) {
                        .error_union => if (result) |value| {
                            if (value == null) break;
                        } else |_| break,
                        .optional => if (result == null) break,
                        else => {},
                    }
                }
            }

            pub fn any(self: @This()) Generator(util.Any(T), need_allocator) {
                return .{
                    .allocator = self.allocator,
                    .ptr = self.ptr,
                    .callback = @ptrCast(self.callback),
                };
            }
        }
    else
        struct {
            ptr: ?*anyopaque = null,
            callback: *const fn (?*anyopaque, T) bool,

            pub const payload = T;
            pub const internal_type = .generator;

            pub fn init(ptr: ?*const anyopaque, cb: anytype) @This() {
                return .{
                    .ptr = @constCast(ptr),
                    .callback = util.getCallback(fn (?*anyopaque, T) bool, cb),
                };
            }

            pub fn yield(self: @This(), value: T) bool {
                return self.callback(self.ptr, value);
            }

            pub fn end(self: anytype) void {
                _ = self.yield(null);
            }

            pub fn pipe(self: anytype, arg: anytype) void {
                const AT = @TypeOf(arg);
                if (util.IteratorReturnValue(AT) == null) {
                    @compileError("Expecting an iterator, received: " ++ @typeName(AT));
                }
                var iter = switch (@typeInfo(AT)) {
                    .error_union => arg catch |err| {
                        _ = self.yield(err);
                        return;
                    },
                    else => arg,
                };
                defer if (@hasDecl(@TypeOf(iter), "deinit")) iter.deinit();
                while (true) {
                    const result = iter.next();
                    // break if callback returns false
                    if (!self.yield(result)) break;
                    // break if result is an error or null
                    switch (@typeInfo(@TypeOf(result))) {
                        .error_union => if (result) |value| {
                            if (value == null) break;
                        } else |_| break,
                        .optional => if (result == null) break,
                        else => {},
                    }
                }
            }

            pub fn any(self: @This()) Generator(util.Any(T), need_allocator) {
                return .{
                    .ptr = self.ptr,
                    .callback = @ptrCast(self.callback),
                };
            }
        };
}

pub fn GeneratorOf(comptime arg: anytype) type {
    const FT = util.Function(arg);
    const f = @typeInfo(FT).@"fn";
    return if (util.IteratorReturnValue(f.return_type.?)) |T|
        Generator(T, util.isIteratorAllocating(f.return_type.?))
    else
        @compileError("Function does not return an iterator: " ++ @typeName(FT));
}

pub fn GeneratorArgOf(comptime arg: anytype) type {
    const FT = util.Function(arg);
    const f = @typeInfo(FT).@"fn";
    return inline for (f.params) |param| {
        if (util.getInternalType(param.type) == .generator) break param.type.?;
    } else @compileError("No generator argument: " ++ @typeName(FT));
}
