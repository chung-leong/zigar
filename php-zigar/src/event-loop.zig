const std = @import("std");

const php = @import("php.zig");
const ExecuteData = php.ExecuteData;
const Value = php.Value;
const ArgumentIterator = php.ArgumentIterator;

pub fn EventLoop(comptime cb: fn () void) type {
    const Temporary = struct {
        fiber: Value,
        stream: Value,
        terminated: bool,

        pub fn init(self: *@This(), stream: *const Value) !void {
            // create closure for loop fiber
            const handler = php.transform(runLoop);
            var func = php.createFunction(&handler, "onReadable");
            func.internal_function.reserved[0] = self;
            const closure = php.createValueClosure(&func, null, null, null);
            errdefer php.release(&closure);
            // create the fiber used for handling the command stream
            self.fiber = try php.createValueNewObject(php.persistent("Fiber"), &.{closure});
            errdefer php.release(&self.fiber);
            self.stream = stream.*;
            php.addRef(stream);
            self.terminated = false;
            // star the fiber
            _ = php.invokeMethod(&self.fiber, "start", .{}) catch |err| {
                std.debug.print("error = {}\n", .{err});
            };
        }

        pub fn deinit(self: *@This()) void {
            self.terminated = true;
            // jump into the loop fiber so the loop would terminate
            self.resumeLoop() catch {};
            php.release(&self.fiber);
            php.release(&self.stream);
        }

        pub fn getFiber(_: *@This()) !Value {
            // the temporary loop is used in the absence of an event loop
            // just return a null value since we'd only be suspending the main fiber
            return php.createValueNull();
        }

        pub fn suspendFiber(self: *@This(), _: *const Value) !void {
            // suspend fiber by switching into loop fiber
            std.debug.print("EventLoop.suspendFiber() called\n", .{});
            try self.resumeLoop();
            std.debug.print("EventLoop.suspendFiber() resumed\n", .{});
        }

        pub fn resumeFiber(self: *@This(), _: *const Value) void {
            // return to original fiber by suspending loop fiber
            std.debug.print("EventLoop.resumeFiber() called\n", .{});
            self.suspendLoop();
            std.debug.print("EventLoop.resumeFiber() resumed\n", .{});
        }

        pub fn suspendLoop(self: *@This()) void {
            const null_value = php.createValueNull();
            _ = php.invokeMethod(&self.fiber, "suspend", .{null_value}) catch {
                @panic("Unable to resume fiber");
            };
        }

        pub fn resumeLoop(self: *@This()) !void {
            _ = try php.invokeMethod(&self.fiber, "resume", .{});
        }

        pub fn runLoop(ed: *ExecuteData, _: *Value) void {
            const self: *@This() = @ptrCast(@alignCast(ed.func.*.internal_function.reserved[0]));
            const stream_select = php.createValueString(php.persistent("stream_select"));
            const read_fds = php.createValueReference(&php.createValueArray(null));
            defer php.release(&read_fds);
            const write_fds = php.createValueReference(&php.createValueNull());
            defer php.release(&write_fds);
            const except_fds = php.createValueReference(&php.createValueNull());
            defer php.release(&except_fds);
            const timeout = php.createValueNull();
            // wait for activation by main fiber
            self.suspendLoop();
            std.debug.print("EventLoop.runLoop() resumed\n", .{});
            while (!self.terminated) {
                // halt thread until stream is ready to be read
                const fd_array_ref = php.getValueReference(&read_fds) catch unreachable;
                const fd_array = php.getValueArray(&fd_array_ref.val) catch unreachable;
                php.setHashEntryRef(fd_array, 0, &self.stream);
                std.debug.print("EventLoop.runLoop() calling select()\n", .{});
                const result = php.invokeFunction(&stream_select, &.{
                    read_fds,
                    write_fds,
                    except_fds,
                    timeout,
                }) catch @panic("Unable to run stream_select()");
                std.debug.print("EventLoop.runLoop() resumed from select()\n", .{});
                // invoke the callback if the stream is ready
                const count = php.getValueLong(&result) catch 0;
                if (count == 1) cb();
            }
            std.debug.print("EventLoop.runLoop() exiting\n", .{});
        }
    };
    const Revolt = struct {
        namespace: Value,
        handler_id: Value,

        pub fn init(self: *@This(), stream: *const Value) !void {
            const handler = php.transform(onReadable);
            var func = php.createFunction(&handler, "onReadable");
            const closure = php.createValueClosure(&func, null, null, null);
            errdefer php.release(&closure);
            self.namespace = php.createValueString(php.persistent("Revolt\\EventLoop"));
            self.handler_id = try php.invokeMethod(&self.namespace, "onReadable", .{ stream, closure });
        }

        pub fn deinit(self: *@This()) void {
            _ = php.invokeMethod(&self.namespace, "cancel", .{self.handler_id}) catch {};
            php.release(&self.handler_id);
        }

        pub fn getFiber(self: *@This()) !Value {
            return php.invokeMethod(&self.namespace, "getSuspension", .{});
        }

        pub fn suspendFiber(_: *@This(), fiber: *const Value) !void {
            _ = try php.invokeMethod(fiber, "suspend", .{});
        }

        pub fn resumeFiber(_: *@This(), fiber: *const Value) void {
            const null_value = php.createValueNull();
            _ = php.invokeMethod(fiber, "resume", .{null_value}) catch {
                @panic("Unable to resume fiber");
            };
        }

        pub fn onReadable(_: *ExecuteData, _: *Value) void {
            cb();
        }
    };
    return struct {
        type: Type = .temporary,
        loop: Loop = .{ .temporary = undefined },
        ready: bool = false,

        pub const Type = enum { temporary, revolt };

        const Loop = union {
            temporary: Temporary,
            revolt: Revolt,
        };

        pub fn use(self: *@This(), new_type: Type) void {
            self.deinit();
            self.ready = false;
            self.type = new_type;
            self.loop = switch (new_type) {
                inline else => |t| @unionInit(Loop, @tagName(t), undefined),
            };
        }

        pub fn init(self: *@This(), stream: *const Value) !void {
            self.ready = true;
            errdefer self.ready = false;
            switch (self.type) {
                inline else => |t| try @field(self.loop, @tagName(t)).init(stream),
            }
        }

        pub fn deinit(self: *@This()) void {
            if (!self.ready) return;
            self.ready = false;
            switch (self.type) {
                inline else => |t| @field(self.loop, @tagName(t)).deinit(),
            }
        }

        pub fn getFiber(self: *@This()) !Value {
            if (!self.ready) return error.NoEventLoop;
            return switch (self.type) {
                inline else => |t| @field(self.loop, @tagName(t)).getFiber(),
            };
        }

        pub fn suspendFiber(self: *@This(), fiber: *const Value) !void {
            if (!self.ready) return error.NoEventLoop;
            switch (self.type) {
                inline else => |t| try @field(self.loop, @tagName(t)).suspendFiber(fiber),
            }
        }

        pub fn resumeFiber(self: *@This(), fiber: *const Value) void {
            if (!self.ready) @panic("No event loop");
            switch (self.type) {
                inline else => |t| try @field(self.loop, @tagName(t)).resumeFiber(fiber),
            }
        }
    };
}
