const std = @import("std");

const AbortSignal = @import("abort-signal.zig").AbortSignal;
const extension = @import("extension.zig");
const failure = @import("failure.zig");
const io = @import("system.zig").io;
const php_ng = @import("php/root.zig");
const Array = php_ng.Array;
const Closure = php_ng.Closure;
const Function = php_ng.Function;
const Object = php_ng.Object;
const String = php_ng.String;
const Value = php_ng.Value;
const N = String.static;

pub const LoopType = enum {
    temporary,
    revolt,
};

pub fn EventLoop(comptime cb: fn () void) type {
    const Temporary = struct {
        fiber: Value,
        fiber_cache: Object.MethodCallCache(.{ .start, .@"resume" }),
        fiber_class_cache: Object.MethodCallCache(.{.@"suspend"}),
        stream: Value,
        in_loop: bool,
        terminated: bool,
        deinit_deferred: bool,
        timeouts: std.ArrayList(Timeout),

        const Timeout = struct {
            end: i64,
            signal: *AbortSignal,
        };

        pub fn init(self: *@This(), stream: Value) !void {
            // create closure for loop fiber
            var func: Function = .fromHandler(onLoopRun, null);
            // TODO: use this value instead
            func.impl.internal_function.reserved[0] = self;
            const closure: Closure = .create(&func, null, null, null);
            defer closure.release();
            // create the fiber used for handling the command stream
            const fiber_obj = try Object.createFromName(N("Fiber"), &.{closure.toValue()});
            errdefer fiber_obj.release();
            self.fiber = .fromObject(fiber_obj);
            self.fiber_cache = try .init(self.fiber);
            const class_name_value: Value = .fromString(N("Fiber"));
            self.fiber_class_cache = try .init(class_name_value);
            errdefer self.fiber_class_cache.deinit();
            self.stream = stream;
            self.terminated = false;
            self.in_loop = false;
            self.deinit_deferred = false;
            self.timeouts = .empty;
            // start the loop fiber
            self.in_loop = true;
            _ = try self.fiber_cache.method.start.invoke(&.{});
        }

        pub fn deinit(self: *@This()) void {
            if (!self.in_loop) {
                if (!self.terminated) {
                    self.terminated = true;
                    // jump into the loop fiber so the loop would terminate
                    _ = self.fiber_cache.method.@"resume".invoke(&.{}) catch {};
                }
                self.fiber.release();
                self.fiber_cache.deinit();
                self.fiber_class_cache.deinit();
            } else {
                self.terminated = true;
                self.deinit_deferred = true;
            }
        }

        pub fn getFiber(_: *@This()) !Value {
            // the temporary loop is used in the absence of an event loop
            // just return a null value since we'd only be suspending the main fiber
            return .fromNull();
        }

        pub fn suspendFiber(self: *@This(), _: Value) !void {
            // suspend fiber by switching into loop fiber
            try self.resumeLoop();
        }

        pub fn resumeFiber(self: *@This(), _: Value) !void {
            // return to original fiber by suspending loop fiber
            try self.suspendLoop();
        }

        pub fn suspendLoop(self: *@This()) !void {
            self.in_loop = false;
            _ = try self.fiber_class_cache.method.@"suspend".invoke(&.{});
        }

        pub fn resumeLoop(self: *@This()) !void {
            if (self.in_loop) {
                return failure.report("cannot call async functions when the event loop 'temporary' is used", .{});
            }
            self.in_loop = true;
            _ = try self.fiber_cache.method.@"resume".invoke(&.{});
            if (self.deinit_deferred) {
                self.deinit();
            }
        }

        pub fn addTimeout(self: *@This(), seconds: f64, signal: *AbortSignal) !void {
            const duration: i64 = @intFromFloat(seconds * 1_000_000.0);
            const timestamp = std.Io.Clock.real.now(io);
            try self.timeouts.append(std.heap.c_allocator, .{
                .end = timestamp.toMicroseconds() + duration,
                .signal = signal,
            });
            signal.addRef();
        }

        fn updateTimouts(self: *@This()) @Tuple(&.{ Value, Value }) {
            const timestamp = std.Io.Clock.real.now(io);
            const len = self.timeouts.items.len;
            var pause: ?i64 = null;
            for (0..len) |i| {
                const index = len - i - 1;
                var item = self.timeouts.items[index];
                if (timestamp.toMicroseconds() >= item.end) {
                    // set the abort signal and remove it from the list
                    item.signal.abort();
                    item.signal.release();
                    _ = self.timeouts.swapRemove(index);
                } else {
                    // choose the smallest duration
                    const diff = item.end - timestamp.toMicroseconds();
                    if (pause == null or pause.? > diff) {
                        pause = diff;
                    }
                }
            }
            if (pause) |us| {
                const s_u64 = @min(std.math.maxInt(c_long), @divFloor(us, 1_000_000));
                const s: c_long = @intCast(s_u64);
                const us_remainder: c_long = @intCast(us - s_u64 * 1_000_000);
                return .{ .fromInteger(s), .fromInteger(us_remainder) };
            } else {
                return .{ .fromNull(), .fromNull() };
            }
        }

        pub fn onLoopRun(arguments: *Function.Arguments, _: *Value) !void {
            const func = arguments.callee();
            const ptr = func.impl.internal_function.reserved[0].?;
            const self: *@This() = @ptrCast(@alignCast(ptr));
            const array_value: Value = .fromArray(.create());
            const null_value: Value = .fromNull();
            const read_fds: Value = .fromReference(.create(array_value));
            defer read_fds.release();
            const write_fds: Value = .fromReference(.create(null_value));
            defer write_fds.release();
            const except_fds: Value = .fromReference(.create(null_value));
            defer except_fds.release();
            // wait for activation by main fiber
            self.suspendLoop() catch {
                // main fiber has exited already
                self.terminated = true;
                return;
            };
            var stream_select_cache: Function.CallCache = try .initFromName(N("stream_select"));
            defer stream_select_cache.deinit();
            while (!self.terminated) {
                // update or update timeouts and get the duration to the closest one
                const timeout_s, const timeout_us = self.updateTimouts();
                // halt thread until stream is ready to be read
                const fd_array_ref = read_fds.reference();
                const fd_array = fd_array_ref.target().array();
                fd_array.set(0, self.stream);
                const result = stream_select_cache.invoke(&.{
                    read_fds,
                    write_fds,
                    except_fds,
                    timeout_s,
                    timeout_us,
                }) catch @panic("Unable to run stream_select()");
                // invoke the callback if the stream is ready
                if (result.integer() == 1) {
                    cb();
                    if (php_ng.exceptionThrown()) {
                        // when the main fiber exits, the loop fiber receive a GracefulExit exception
                        self.terminated = true;
                    }
                }
            }
        }
    };
    const Revolt = struct {
        revolt_class_cache: Object.MethodCallCache(.{
            .cancel,
            .getSuspension,
            .onReadable,
        }),
        handler_id: Value,

        pub fn init(self: *@This(), stream: Value) !void {
            var func: Function = .fromHandler(onReadable, null);
            const closure: Closure = .create(&func, null, null, null);
            defer closure.release();
            const class: Value = .fromString(N("Revolt\\EventLoop"));
            self.revolt_class_cache = try .init(class);
            errdefer self.revolt_class_cache.deinit();
            self.handler_id = try self.revolt_class_cache.method.onReadable.invoke(&.{ stream, closure.toValue() });
        }

        pub fn deinit(self: *@This()) void {
            _ = self.revolt_class_cache.method.cancel.invoke(&.{self.handler_id}) catch {};
            self.handler_id.release();
            self.revolt_class_cache.deinit();
        }

        pub fn getFiber(self: *@This()) !Value {
            return try self.revolt_class_cache.method.getSuspension.invoke(&.{});
        }

        pub fn suspendFiber(_: *@This(), fiber: Value) !void {
            var fiber_cache: Object.MethodCallCache(.{.@"suspend"}) = try .init(fiber);
            _ = try fiber_cache.method.@"suspend".invoke(&.{});
        }

        pub fn resumeFiber(_: *@This(), fiber: Value) !void {
            var fiber_cache: Object.MethodCallCache(.{.@"resume"}) = try .init(fiber);
            _ = try fiber_cache.method.@"resume".invoke(&.{});
        }

        pub fn addTimeout(self: *@This(), seconds: f64, signal: *AbortSignal) !void {
            var func: Function = .fromHandler(onDelayFinished, null);
            const signal_value: Value = .fromObject(@ptrCast(signal.object()));
            const closure: Closure = .create(&func, null, null, signal_value);
            defer closure.release();
            self.handler_id = try self.revolt_class_cache.method.onReadable.invoke(&.{
                .fromFloat(seconds),
                closure.toValue(),
            });
        }

        pub fn onReadable(_: *Function.Arguments, _: *Value) void {
            cb();
        }

        pub fn onDelayFinished(args: *Function.Arguments, _: *Value) !void {
            const obj = try args.this().getObject();
            const obj_og: *php_ng.c.zend_object = @ptrCast(obj);
            const signal = AbortSignal.fromObject(obj_og);
            signal.abort();
        }
    };
    return struct {
        loop: Loop = .{ .temporary = undefined },
        stream: Value = undefined,
        ready: bool = false,
        pendingFiber: ?Value = null,

        const Loop = union(LoopType) {
            temporary: Temporary,
            revolt: Revolt,
        };

        pub fn reset(self: *@This()) void {
            self.deinit();
            self.loop = .{ .temporary = undefined };
        }

        pub fn use(self: *@This(), type_name: []const u8) !void {
            const loop_type = inline for (comptime std.meta.fieldNames(LoopType)) |field_name| {
                if (std.mem.eql(u8, field_name, type_name)) {
                    break @field(LoopType, field_name);
                }
            } else return error.InvalidLoopType;
            if (self.loop == loop_type) return;
            const was_ready = self.ready;
            if (was_ready) {
                // set ready to false since we're in the progress of disabling the current loop
                self.ready = false;
                self.deinitImpl();
            }
            // set the tagged union
            switch (loop_type) {
                inline else => |t| self.loop = @unionInit(Loop, @tagName(t), undefined),
            }
            if (was_ready) {
                try self.initImpl();
                self.ready = true;
            }
        }

        pub fn init(self: *@This(), stream: Value) !void {
            if (self.ready) return;
            self.stream = stream.retain();
            try self.initImpl();
            self.ready = true;
            // register a shutdown function for the purpose of shutting down the loop
            try extension.shutdown_callbacks.add(self, onShutdown);
        }

        fn initImpl(self: *@This()) !void {
            switch (self.loop) {
                inline else => |*impl| try impl.init(self.stream),
            }
        }

        pub fn deinit(self: *@This()) void {
            if (!self.ready) return;
            self.ready = false;
            extension.shutdown_callbacks.remove(self, onShutdown);
            self.deinitImpl();
            self.stream.release();
        }

        fn deinitImpl(self: *@This()) void {
            switch (self.loop) {
                inline else => |*impl| impl.deinit(),
            }
        }

        pub fn isProper(self: *@This()) bool {
            return switch (self.loop) {
                .temporary => false,
                else => true,
            };
        }

        pub fn getFiber(self: *@This()) !Value {
            if (!self.ready) return error.NoEventLoop;
            return switch (self.loop) {
                inline else => |*impl| impl.getFiber(),
            };
        }

        pub fn suspendFiber(self: *@This(), fiber: Value) !void {
            if (!self.ready) return error.NoEventLoop;
            switch (self.loop) {
                inline else => |*impl| try impl.suspendFiber(fiber),
            }
        }

        pub fn resumeFiber(self: *@This(), fiber: Value) void {
            if (!self.ready) @panic("No event loop");
            switch (self.loop) {
                inline else => |*impl| impl.resumeFiber(fiber) catch {},
            }
        }

        pub fn resumeFiberAfterward(self: *@This(), fiber: Value) void {
            self.pendingFiber = fiber;
        }

        pub fn resumePendingFiber(self: *@This()) void {
            if (self.pendingFiber) |fiber| {
                self.pendingFiber = null;
                self.resumeFiber(fiber);
            }
        }

        pub fn addTimeout(self: *@This(), seconds: f64, signal: *AbortSignal) !void {
            switch (self.loop) {
                inline else => |*impl| try impl.addTimeout(seconds, signal),
            }
        }

        pub fn onShutdown(ptr: *anyopaque) void {
            const self: *@This() = @ptrCast(@alignCast(ptr));
            self.deinit();
        }
    };
}
