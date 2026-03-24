const std = @import("std");

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

        pub fn init(self: *@This(), stream: *const Value) !void {
            // create closure for loop fiber
            const handler = php.transform(runLoop);
            var func = php.createFunction(&handler, "runLoop", 0, false);
            func.internal_function.reserved[0] = self;
            const closure = php.createValueClosure(&func, null, null, null);
            errdefer php.release(&closure);
            // create the fiber used for handling the command stream
            const class_name = php.persistent("Fiber");
            self.fiber = try php.createValueNewObject(class_name, &.{closure});
            errdefer php.release(&self.fiber);
            self.stream = stream;
            self.terminated = false;
            // star the loop fiber
            const method = php.createValuePersistentString("start");
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
            const method = php.createValuePersistentString("suspend");
            _ = try php.invokeMethod(&self.fiber, &method, &.{});
        }

        pub fn resumeLoop(self: *@This()) !void {
            const method = php.createValuePersistentString("resume");
            _ = try php.invokeMethod(&self.fiber, &method, &.{});
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
            self.suspendLoop() catch unreachable;
            while (!self.terminated) {
                // halt thread until stream is ready to be read
                const fd_array_ref = php.getValueReference(&read_fds) catch unreachable;
                const fd_array = php.getValueArray(&fd_array_ref.val) catch unreachable;
                php.setHashEntryRef(fd_array, 0, self.stream);
                const result = php.invokeFunction(&stream_select, &.{
                    read_fds,
                    write_fds,
                    except_fds,
                    timeout,
                }) catch @panic("Unable to run stream_select()");
                // invoke the callback if the stream is ready
                const count = php.getValueLong(&result) catch 0;
                if (count == 1) cb();
            }
        }
    };
    const Revolt = struct {
        class_path: Value,
        handler_id: Value,

        pub fn init(self: *@This(), stream: *const Value) !void {
            const handler = php.transform(onReadable);
            var func = php.createFunction(&handler, "onReadable", 0, false);
            const closure = php.createValueClosure(&func, null, null, null);
            errdefer php.release(&closure);
            const method = php.createValuePersistentString("onReadable");
            self.class_path = php.createValuePersistentString("Revolt\\EventLoop");
            self.handler_id = try php.invokeMethod(&self.class_path, &method, &.{ stream.*, closure });
        }

        pub fn deinit(self: *@This()) void {
            const method = php.createValuePersistentString("cancel");
            _ = php.invokeMethod(&self.class_path, &method, &.{self.handler_id}) catch {};
            php.release(&self.handler_id);
        }

        pub fn getFiber(self: *@This()) !Value {
            std.debug.print("EventLoop.getFiber() called\n", .{});
            errdefer std.debug.print("EventLoop.getFiber() failed\n", .{});
            const method = php.createValuePersistentString("getSuspension");
            return php.invokeMethod(&self.class_path, &method, &.{});
        }

        pub fn suspendFiber(_: *@This(), fiber: *const Value) !void {
            std.debug.print("EventLoop.suspendFiber() called\n", .{});
            errdefer std.debug.print("EventLoop.suspendFiber() failed\n", .{});
            defer std.debug.print("EventLoop.suspendFiber() resumed\n", .{});
            const method = php.createValuePersistentString("suspend");
            _ = try php.invokeMethod(fiber, &method, &.{});
        }

        pub fn resumeFiber(_: *@This(), fiber: *const Value) !void {
            std.debug.print("EventLoop.resumeFiber() called\n", .{});
            errdefer std.debug.print("EventLoop.resumeFiber() failed\n", .{});
            defer std.debug.print("EventLoop.resumeFiber() resumed\n", .{});
            const method = php.createValuePersistentString("resume");
            _ = try php.invokeMethod(fiber, &method, &.{});
        }

        pub fn onReadable(_: *ExecuteData, _: *Value) void {
            std.debug.print("EventLoop.onReadable() called\n", .{});
            defer std.debug.print("EventLoop.onReadable() resumed\n", .{});
            cb();
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
                const handler = php.transform(shutdown);
                var func = php.createFunction(&handler, "shutdown", 0, false);
                func.internal_function.reserved[0] = self;
                const closure = php.createValueClosure(&func, null, null, null);
                errdefer php.release(&closure);
                const register = php.createValueString(php.persistent("register_shutdown_function"));
                _ = try php.invokeFunction(&register, &.{closure});
                self.registered = true;
            }
            self.stream = stream.*;
            switch (self.type) {
                inline else => |t| try @field(self.loop, @tagName(t)).init(&self.stream),
            }
            self.ready = true;
            php.addRef(&self.stream);
        }

        pub fn deinit(self: *@This()) void {
            if (!self.ready) return;
            self.ready = false;
            switch (self.type) {
                inline else => |t| @field(self.loop, @tagName(t)).deinit(),
            }
            php.release(&self.stream);
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
                inline else => |t| @field(self.loop, @tagName(t)).resumeFiber(fiber) catch {},
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

        pub fn shutdown(ed: *ExecuteData, _: *Value) void {
            const self: *@This() = @ptrCast(@alignCast(ed.func.*.internal_function.reserved[0]));
            self.deinit();
        }
    };
}
