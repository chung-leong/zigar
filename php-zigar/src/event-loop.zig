const std = @import("std");

const AbortSignal = @import("abort-signal.zig").AbortSignal;
const php = @import("php.zig");
const String = php.String;
const ExecuteData = php.ExecuteData;
const Value = php.Value;
const ArgumentIterator = php.ArgumentIterator;

pub fn EventLoop(comptime cb: fn () void) type {
    const Temporary = struct {
        fiber: Value,
        stream: *const Value,
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
            errdefer php.release(&closure);
            // create the fiber used for handling the command stream
            const class_name = php.persistent("Fiber");
            self.fiber = try php.createValueNewObject(class_name, &.{closure});
            errdefer php.release(&self.fiber);
            self.stream = stream;
            self.terminated = false;
            self.timer = try .start();
            self.timeouts = .empty;
            // star the loop fiber
            const method = php.createValueString(php.persistent("start"));
            _ = try php.invokeMethod(&self.fiber, &method, &.{});
        }

        pub fn deinit(self: *@This()) void {
            self.terminated = true;
            // jump into the loop fiber so the loop would terminate
            self.resumeLoop() catch {};
            php.release(&self.fiber);
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
            const method = php.createValueString(php.persistent("suspend"));
            _ = try php.invokeMethod(&self.fiber, &method, &.{});
        }

        pub fn resumeLoop(self: *@This()) !void {
            const method = php.createValueString(php.persistent("resume"));
            _ = try php.invokeMethod(&self.fiber, &method, &.{});
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
                const s_u64 = @min(std.math.maxInt(c_long), nanosecs / 1_000_000_000);
                const s: c_long = @intCast(s_u64);
                const us: c_long = @intCast(((nanosecs - s_u64 * 1_000_000_000) + 999) / 1000);
                return .{ php.createValueLong(s), php.createValueLong(us) };
            } else {
                return .{ php.createValueNull(), php.createValueNull() };
            }
        }

        pub fn handleLoop(ed: *ExecuteData, _: *Value) void {
            const self: *@This() = @ptrCast(@alignCast(ed.func.*.internal_function.reserved[0]));
            const stream_select = php.createValueString(php.persistent("stream_select"));
            const read_fds = php.createValueReference(&php.createValueArray(null));
            defer php.release(&read_fds);
            const write_fds = php.createValueReference(&php.createValueNull());
            defer php.release(&write_fds);
            const except_fds = php.createValueReference(&php.createValueNull());
            defer php.release(&except_fds);
            // wait for activation by main fiber
            self.suspendLoop() catch unreachable;
            while (!self.terminated) {
                // update or update timeouts and get the duration to the closest one
                const timeout_s, const timeout_us = self.updateTimouts();
                // halt thread until stream is ready to be read
                const fd_array_ref = php.getValueReference(&read_fds) catch unreachable;
                const fd_array = php.getValueArray(&fd_array_ref.val) catch unreachable;
                php.setHashEntryRef(fd_array, 0, self.stream);
                const result = php.invokeFunction(&stream_select, &.{
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
                }
            }
        }
    };
    const Revolt = struct {
        class_path: Value,
        handler_id: Value,

        pub fn init(self: *@This(), stream: *const Value) !void {
            var func = php.createTransformedFunction(onReadable, "onReadable", 0, false);
            const closure = php.createValueClosure(&func, null, null, null);
            errdefer php.release(&closure);
            const method = php.createValueString(php.persistent("onReadable"));
            self.class_path = php.createValueString(php.persistent("Revolt\\EventLoop"));
            self.handler_id = try php.invokeMethod(&self.class_path, &method, &.{ stream.*, closure });
        }

        pub fn deinit(self: *@This()) void {
            const method = php.createValueString(php.persistent("cancel"));
            _ = php.invokeMethod(&self.class_path, &method, &.{self.handler_id}) catch {};
            php.release(&self.handler_id);
        }

        pub fn getFiber(self: *@This()) !Value {
            std.debug.print("EventLoop.getFiber() called\n", .{});
            errdefer std.debug.print("EventLoop.getFiber() failed\n", .{});
            const method = php.createValueString(php.persistent("getSuspension"));
            return php.invokeMethod(&self.class_path, &method, &.{});
        }

        pub fn suspendFiber(_: *@This(), fiber: *const Value) !void {
            std.debug.print("EventLoop.suspendFiber() called\n", .{});
            errdefer std.debug.print("EventLoop.suspendFiber() failed\n", .{});
            defer std.debug.print("EventLoop.suspendFiber() resumed\n", .{});
            const method = php.createValueString(php.persistent("suspend"));
            _ = try php.invokeMethod(fiber, &method, &.{});
        }

        pub fn resumeFiber(_: *@This(), fiber: *const Value) !void {
            std.debug.print("EventLoop.resumeFiber() called\n", .{});
            errdefer std.debug.print("EventLoop.resumeFiber() failed\n", .{});
            defer std.debug.print("EventLoop.resumeFiber() resumed\n", .{});
            const method = php.createValueString(php.persistent("resume"));
            _ = try php.invokeMethod(fiber, &method, &.{});
        }

        pub fn addTimeout(self: *@This(), seconds: f64, signal: *AbortSignal) !void {
            var func = php.createTransformedFunction(onDelayFinished, "onDelayFinished", 0, false);
            var signal_value = php.createValueObject(signal.object());
            const closure = php.createValueClosure(&func, null, null, &signal_value);
            const method = php.createValueString(php.persistent("onReadable"));
            const timeout = php.createValueDouble(seconds);
            self.class_path = php.createValueString(php.persistent("Revolt\\EventLoop"));
            self.handler_id = try php.invokeMethod(&self.class_path, &method, &.{ timeout, closure });
        }

        pub fn onReadable(_: *ExecuteData, _: *Value) void {
            std.debug.print("EventLoop.onReadable() called\n", .{});
            defer std.debug.print("EventLoop.onReadable() resumed\n", .{});
            cb();
        }

        pub fn onDelayFinished(ed: *ExecuteData, _: *Value) !void {
            const obj = try php.getValueObject(&ed.This);
            const signal = AbortSignal.fromObject(obj);
            signal.abort();
        }
    };
    return struct {
        type: Type = .temporary,
        loop: Loop = .{ .temporary = undefined },
        stream: Value = undefined,
        ready: bool = false,
        registered: bool = false,
        pendingFiber: ?*const Value = null,

        pub const Type = enum { temporary, revolt };

        const Loop = union {
            temporary: Temporary,
            revolt: Revolt,
        };

        pub fn reset(self: *@This()) void {
            self.deinit();
            self.loop = .{ .temporary = undefined };
        }

        pub fn use(self: *@This(), type_name: *const String) !void {
            const reinit = self.ready;
            if (self.ready) {
                self.deinit();
                self.ready = false;
            }
            inline for (@typeInfo(Type).@"enum".fields) |field| {
                if (std.mem.eql(u8, field.name, php.getStringContent(type_name))) {
                    const tag = @field(Type, field.name);
                    self.type = tag;
                    self.loop = @unionInit(Loop, @tagName(tag), undefined);
                    if (reinit) {
                        try @field(self.loop, field.name).init(&self.stream);
                        self.ready = true;
                    }
                    break;
                }
            } else return error.InvalidLoopType;
        }

        pub fn init(self: *@This(), stream: *const Value) !void {
            if (self.ready) return;
            if (!self.registered) {
                // register a shutdown function for the purpose of shutting down the loop
                var func = php.createTransformedFunction(handleShutdown, "shutdown", 0, false);
                func.internal_function.reserved[0] = self;
                const closure = php.createValueClosure(&func, null, null, null);
                errdefer php.release(&closure);
                const register = php.createValueString(php.persistent("register_shutdown_function"));
                _ = try php.invokeFunction(&register, &.{closure});
                self.registered = true;
            }
            self.stream = stream.*;
            switch (self.type) {
                inline else => |t| {
                    const loop = &@field(self.loop, @tagName(t));
                    try loop.init(&self.stream);
                },
            }
            self.ready = true;
            php.addRef(&self.stream);
        }

        pub fn deinit(self: *@This()) void {
            if (!self.ready) return;
            self.ready = false;
            switch (self.type) {
                inline else => |t| {
                    const loop = &@field(self.loop, @tagName(t));
                    loop.deinit();
                },
            }
            php.release(&self.stream);
        }

        pub fn getFiber(self: *@This()) !Value {
            if (!self.ready) return error.NoEventLoop;
            return switch (self.type) {
                inline else => |t| get: {
                    const loop = &@field(self.loop, @tagName(t));
                    break :get loop.getFiber();
                },
            };
        }

        pub fn suspendFiber(self: *@This(), fiber: *const Value) !void {
            if (!self.ready) return error.NoEventLoop;
            switch (self.type) {
                inline else => |t| {
                    const loop = &@field(self.loop, @tagName(t));
                    try loop.suspendFiber(fiber);
                },
            }
        }

        pub fn resumeFiber(self: *@This(), fiber: *const Value) void {
            if (!self.ready) @panic("No event loop");
            switch (self.type) {
                inline else => |t| {
                    const loop = &@field(self.loop, @tagName(t));
                    loop.resumeFiber(fiber) catch {};
                },
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
            switch (self.type) {
                inline else => |t| {
                    const loop = &@field(self.loop, @tagName(t));
                    try loop.addTimeout(seconds, signal);
                },
            }
        }

        pub fn handleShutdown(ed: *ExecuteData, _: *Value) void {
            const self: *@This() = @ptrCast(@alignCast(ed.func.*.internal_function.reserved[0]));
            self.deinit();
        }
    };
}
