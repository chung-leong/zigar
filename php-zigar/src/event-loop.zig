const std = @import("std");

const AbortSignal = @import("abort-signal.zig").AbortSignal;
const extension = @import("extension.zig");
const failure = @import("failure.zig");
const php = @import("php.zig");
const FunctionCallCache = php.FunctionCallCache;
const MethodCallCaches = php.MethodCallCaches;
const N = php.getStaticString;
const Long = php.Long;
const String = php.String;
const ExecuteData = php.ExecuteData;
const Value = php.Value;
const ArgumentIterator = php.ArgumentIterator;

pub fn EventLoop(comptime cb: fn () void) type {
    const Temporary = struct {
        fiber: Value,
        fiber_cache: MethodCallCaches(.{ .start, .@"resume" }),
        fiber_class_cache: MethodCallCaches(.{.@"suspend"}),
        stream: *const Value,
        in_loop: bool,
        terminated: bool,
        timer: std.time.Timer,
        timeouts: std.ArrayList(Timeout),

        const Timeout = struct {
            end: u64,
            signal: *AbortSignal,
        };

        pub fn init(self: *@This(), stream: *const Value) !void {
            // create closure for loop fiber
            var func = php.createTransformedFunction(handleLoop, "loop", 0, false);
            func.internal_function.reserved[0] = self;
            const closure = php.createValueClosure(&func, null, null, null);
            defer php.release(&closure);
            // create the fiber used for handling the command stream
            self.fiber = try php.createValueNewObject(N("Fiber"), &.{closure});
            errdefer php.release(&self.fiber);
            self.fiber_cache = try .init(&self.fiber);
            const class_name_value = php.createValueString(N("Fiber"));
            self.fiber_class_cache = try .init(&class_name_value);
            errdefer self.fiber_class_cache.deinit();
            self.stream = stream;
            self.terminated = false;
            self.in_loop = false;
            self.timer = try .start();
            self.timeouts = .empty;
            // star the loop fiber
            _ = try self.fiber_cache.method.start.invoke(&.{});
        }

        pub fn deinit(self: *@This()) void {
            if (!self.terminated) {
                self.terminated = true;
                // jump into the loop fiber so the loop would terminate
                self.resumeLoop() catch {};
            }
            php.release(&self.fiber);
            self.fiber_cache.deinit();
            self.fiber_class_cache.deinit();
        }

        pub fn getFiber(_: *@This()) !Value {
            // the temporary loop is used in the absence of an event loop
            // just return a null value since we'd only be suspending the main fiber
            return php.createValueNull();
        }

        pub fn suspendFiber(self: *@This(), _: *const Value) !void {
            // suspend fiber by switching into loop fiber
            try self.resumeLoop();
        }

        pub fn resumeFiber(self: *@This(), _: *const Value) !void {
            // return to original fiber by suspending loop fiber
            try self.suspendLoop();
        }

        pub fn suspendLoop(self: *@This()) !void {
            _ = try self.fiber_class_cache.method.@"suspend".invoke(&.{});
        }

        pub fn resumeLoop(self: *@This()) !void {
            if (self.in_loop) {
                return failure.report("cannot call async functions when the event loop 'temporary' is used", .{});
            }
            self.in_loop = true;
            _ = try self.fiber_cache.method.@"resume".invoke(&.{});
            self.in_loop = false;
        }

        pub fn addTimeout(self: *@This(), seconds: f64, signal: *AbortSignal) !void {
            const duration: u64 = @intFromFloat(seconds * 1_000_000_000.0);
            if (self.timeouts.items.len == 0) self.timer.reset();
            try self.timeouts.append(std.heap.c_allocator, .{
                .end = self.timer.read() + duration,
                .signal = signal,
            });
            signal.addRef();
        }

        fn updateTimouts(self: *@This()) std.meta.Tuple(&.{ Value, Value }) {
            const now = self.timer.read();
            const len = self.timeouts.items.len;
            var pause: ?u64 = null;
            for (0..len) |i| {
                const index = len - i - 1;
                var item = self.timeouts.items[index];
                if (now >= item.end) {
                    // set the abort signal and remove it from the list
                    item.signal.abort();
                    item.signal.release();
                    _ = self.timeouts.swapRemove(index);
                } else {
                    // choose the smallest duration
                    const diff = item.end - now;
                    if (pause == null or pause.? > diff) {
                        pause = diff;
                    }
                }
            }
            if (pause) |nanosecs| {
                const s_u64 = @min(std.math.maxInt(Long), nanosecs / 1_000_000_000);
                const s: Long = @intCast(s_u64);
                const us: Long = @intCast(((nanosecs - s_u64 * 1_000_000_000) + 999) / 1000);
                return .{ php.createValueLong(s), php.createValueLong(us) };
            } else {
                return .{ php.createValueNull(), php.createValueNull() };
            }
        }

        pub fn handleLoop(ed: *ExecuteData, _: *Value) void {
            const self: *@This() = @ptrCast(@alignCast(ed.func.*.internal_function.reserved[0]));
            const read_fds = php.createValueReference(&php.createValueArray(null));
            defer php.release(&read_fds);
            const write_fds = php.createValueReference(&php.createValueNull());
            defer php.release(&write_fds);
            const except_fds = php.createValueReference(&php.createValueNull());
            defer php.release(&except_fds);
            // wait for activation by main fiber
            self.suspendLoop() catch unreachable;
            const stream_select_name = php.createValueString(N("stream_select"));
            var stream_select_cache = FunctionCallCache.init(&stream_select_name) catch {
                @panic("stream_select() is not available");
            };
            defer stream_select_cache.deinit();
            while (!self.terminated) {
                // update or update timeouts and get the duration to the closest one
                const timeout_s, const timeout_us = self.updateTimouts();
                // halt thread until stream is ready to be read
                const fd_array_ref = php.getValueReference(&read_fds) catch unreachable;
                const fd_array = php.getValueArray(&fd_array_ref.val) catch unreachable;
                php.setHashEntryRef(fd_array, 0, self.stream);
                const result = stream_select_cache.invoke(&.{
                    read_fds,
                    write_fds,
                    except_fds,
                    timeout_s,
                    timeout_us,
                }) catch @panic("Unable to run stream_select()");
                // invoke the callback if the stream is ready
                const count = php.getValueLong(&result) catch 0;
                if (count == 1) {
                    cb();
                    if (php.exceptionThrown()) {
                        // when the main fiber exits, the loop fiber receive a GracefulExit exception
                        self.terminated = true;
                    }
                }
            }
        }
    };
    const Revolt = struct {
        revolt_class_cache: MethodCallCaches(.{
            .cancel,
            .getSuspension,
            .onReadable,
        }),
        handler_id: Value,

        pub fn init(self: *@This(), stream: *const Value) !void {
            var func = php.createTransformedFunction(onReadable, "onReadable", 0, false);
            const closure = php.createValueClosure(&func, null, null, null);
            defer php.release(&closure);
            const class = php.createValueString(N("Revolt\\EventLoop"));
            self.revolt_class_cache = try .init(&class);
            errdefer self.revolt_class_cache.deinit();
            self.handler_id = try self.revolt_class_cache.method.onReadable.invoke(&.{ stream.*, closure });
        }

        pub fn deinit(self: *@This()) void {
            _ = self.revolt_class_cache.method.cancel.invoke(&.{self.handler_id}) catch {};
            php.release(&self.handler_id);
            self.revolt_class_cache.deinit();
        }

        pub fn getFiber(self: *@This()) !Value {
            return try self.revolt_class_cache.method.getSuspension.invoke(&.{});
        }

        pub fn suspendFiber(_: *@This(), fiber: *const Value) !void {
            var fiber_cache: MethodCallCaches(.{.@"suspend"}) = try .init(fiber);
            _ = try fiber_cache.method.@"suspend".invoke(&.{});
        }

        pub fn resumeFiber(_: *@This(), fiber: *const Value) !void {
            var fiber_cache: MethodCallCaches(.{.@"resume"}) = try .init(fiber);
            _ = try fiber_cache.method.@"resume".invoke(&.{});
        }

        pub fn addTimeout(self: *@This(), seconds: f64, signal: *AbortSignal) !void {
            var func = php.createTransformedFunction(onDelayFinished, "onDelayFinished", 0, false);
            var signal_value = php.createValueObject(signal.object());
            const closure = php.createValueClosure(&func, null, null, &signal_value);
            defer php.release(&closure);
            const timeout = php.createValueDouble(seconds);
            self.handler_id = try self.revolt_class_cache.method.onReadable.invoke(&.{ timeout, closure });
        }

        pub fn onReadable(_: *ExecuteData, _: *Value) void {
            cb();
        }

        pub fn onDelayFinished(ed: *ExecuteData, _: *Value) !void {
            const obj = try php.getValueObject(&ed.This);
            const signal = AbortSignal.fromObject(obj);
            signal.abort();
        }
    };
    return struct {
        loop: Loop = .{ .temporary = undefined },
        stream: Value = undefined,
        ready: bool = false,
        pendingFiber: ?*const Value = null,

        const Loop = union(enum) {
            temporary: Temporary,
            revolt: Revolt,
        };
        const LoopType = @typeInfo(Loop).@"union".tag_type.?;

        pub fn reset(self: *@This()) void {
            self.deinit();
            self.loop = .{ .temporary = undefined };
        }

        pub fn use(self: *@This(), type_name: []const u8) !void {
            const loop_type = inline for (comptime std.meta.fields(LoopType)) |field| {
                if (std.mem.eql(u8, field.name, type_name)) {
                    break @field(LoopType, field.name);
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

        pub fn init(self: *@This(), stream: *const Value) !void {
            if (self.ready) return;
            self.stream = stream.*;
            try self.initImpl();
            self.ready = true;
            php.addRef(&self.stream);
            // register a shutdown function for the purpose of shutting down the loop
            try extension.addRequestShutdownCallback(self, handleShutdown);
        }

        fn initImpl(self: *@This()) !void {
            switch (self.loop) {
                inline else => |*impl| try impl.init(&self.stream),
            }
        }

        pub fn deinit(self: *@This()) void {
            if (!self.ready) return;
            self.ready = false;
            extension.removeRequestShutdownCallback(self, handleShutdown);
            self.deinitImpl();
            php.release(&self.stream);
        }

        fn deinitImpl(self: *@This()) void {
            switch (self.loop) {
                inline else => |*impl| impl.deinit(),
            }
        }

        pub fn getFiber(self: *@This()) !Value {
            if (!self.ready) return error.NoEventLoop;
            return switch (self.loop) {
                inline else => |*impl| impl.getFiber(),
            };
        }

        pub fn suspendFiber(self: *@This(), fiber: *const Value) !void {
            if (!self.ready) return error.NoEventLoop;
            switch (self.loop) {
                inline else => |*impl| try impl.suspendFiber(fiber),
            }
        }

        pub fn resumeFiber(self: *@This(), fiber: *const Value) void {
            if (!self.ready) @panic("No event loop");
            switch (self.loop) {
                inline else => |*impl| impl.resumeFiber(fiber) catch {},
            }
        }

        pub fn resumeFiberAfterward(self: *@This(), fiber: *const Value) void {
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

        pub fn handleShutdown(ptr: *anyopaque) void {
            const self: *@This() = @ptrCast(@alignCast(ptr));
            self.deinit();
        }
    };
}
