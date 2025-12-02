const std = @import("std");
const expectEqual = std.testing.expectEqual;
const builtin = @import("builtin");

const fn_transform = @import("../zigft/fn-transform.zig");
const Generator = @import("generator.zig").Generator;
const GeneratorOf = @import("generator.zig").GeneratorOf;
const Promise = @import("promise.zig").Promise;
const PromiseOf = @import("promise.zig").PromiseOf;
const Queue = @import("queue.zig").Queue;
const util = @import("util.zig");

pub fn WorkQueue(comptime ns: type, comptime internal_ns: type) type {
    const decls = std.meta.declarations(ns);
    return struct {
        queue: Queue(WorkItem) = undefined,
        thread_count: usize = 0,
        status: Status = .uninitialized,
        init_remaining: usize = undefined,
        init_futex: std.atomic.Value(u32) = undefined,
        init_result: WaitResult = undefined,
        init_promise: ?Promise(WaitResult) = undefined,
        deinit_promise: ?Promise(void) = undefined,

        pub const ThreadStartError = switch (@hasDecl(ns, "onThreadStart")) {
            false => error{},
            true => switch (@typeInfo(util.ReturnValue(ns.onThreadStart))) {
                .error_union => |eu| eu.error_set,
                else => error{},
            },
        };
        pub const ThreadStartParams = switch (@hasDecl(ns, "onThreadStart")) {
            false => struct {},
            true => std.meta.ArgsTuple(@TypeOf(ns.onThreadStart)),
        };
        pub const ThreadEndParams = switch (@hasDecl(ns, "onThreadEnd")) {
            false => struct {},
            true => std.meta.ArgsTuple(@TypeOf(ns.onThreadEnd)),
        };
        pub const Error = std.mem.Allocator.Error || error{Unexpected};
        pub const Options = init: {
            // when thread_start_params or thread_end_params is void, we want it to have a default value
            const fields = std.meta.fields(struct {
                allocator: std.mem.Allocator = def_allocator,
                stack_size: usize = if (builtin.target.cpu.arch.isWasm()) 262144 else std.Thread.SpawnConfig.default_stack_size,
                n_jobs: usize = 1,
                thread_start_params: ThreadStartParams,
                thread_end_params: ThreadEndParams,
            });
            var field_names: [fields.len][]const u8 = undefined;
            var field_types: [fields.len]type = undefined;
            var field_attrs: [fields.len]std.builtin.Type.StructField.Attributes = undefined;
            for (fields, 0..) |field, i| {
                field_names[i] = field.name;
                field_types[i] = field.type;
                field_attrs[i] = .{
                    .default_value_ptr = field.default_value_ptr orelse switch (@sizeOf(field.type)) {
                        0 => @ptrCast(&@as(field.type, .{})),
                        else => null,
                    },
                };
            }
            break :init @Struct(.auto, null, &field_names, &field_types, &field_attrs);
        };
        pub const InitResult = @typeInfo(@TypeOf(init)).@"fn".return_type.?;
        pub const InitError = @typeInfo(InitResult).error_union.error_set;

        pub fn init(self: *@This(), options: Options) !void {
            switch (self.status) {
                .uninitialized => {},
                .initialized => return,
                .deinitializing => return error.Deinitializing,
            }
            const allocator = options.allocator;
            self.queue = .init(allocator);
            self.init_remaining = options.n_jobs;
            self.init_futex = std.atomic.Value(u32).init(0);
            self.init_result = {};
            self.init_promise = null;
            self.deinit_promise = null;
            if (@hasDecl(internal_ns, "onQueueInit")) {
                const result = @call(.auto, internal_ns.onQueueInit, .{});
                switch (@typeInfo(@TypeOf(result))) {
                    .error_union => if (result) |_| {} else |err| return err,
                    else => {},
                }
            }
            errdefer {
                if (@hasDecl(internal_ns, "onQueueDeinit")) {
                    _ = @call(.auto, internal_ns.onQueueDeinit, .{});
                }
                self.queue.stop();
            }
            const min_stack_size: usize = if (std.Thread.use_pthreads) switch (@bitSizeOf(usize)) {
                32 => 4096,
                else => 1048576,
            } else std.heap.pageSize();
            const spawn_config: std.Thread.SpawnConfig = .{
                .stack_size = @max(min_stack_size, options.stack_size),
                .allocator = allocator,
            };
            for (0..options.n_jobs) |_| {
                const thread = try std.Thread.spawn(spawn_config, handleWorkItems, .{
                    self,
                    options.thread_start_params,
                    options.thread_end_params,
                });
                thread.detach();
                self.thread_count += 1;
            }
            self.status = .initialized;
        }

        pub fn wait(self: *@This()) WaitResult {
            std.Thread.Futex.wait(&self.init_futex, 0);
            return self.init_result;
        }

        pub fn waitAsync(self: *@This(), promise: Promise(WaitResult)) void {
            if (self.init_futex.load(.acquire) == 1) {
                promise.resolve(self.init_result);
            } else {
                self.init_promise = promise;
            }
        }

        pub fn deinitAsync(self: *@This(), promise: ?Promise(void)) void {
            switch (self.status) {
                .initialized => {},
                else => {
                    if (promise) |p| p.resolve({});
                    return;
                },
            }
            self.deinit_promise = promise;
            self.status = .deinitializing;
            self.queue.stop();
        }

        pub fn push(self: *@This(), comptime func: anytype, args: ArgsOf(func), dest: ?PromiseOrGenerator(func)) Error!void {
            switch (self.status) {
                .initialized => {},
                else => {
                    // see if we can do initialize automatically
                    const can_auto_init = check: {
                        if (std.meta.fields(ThreadStartParams).len > 0) break :check false;
                        if (std.meta.fields(ThreadEndParams).len > 0) break :check false;
                        if (self.status != .uninitialized) break :check false;
                        break :check true;
                    };
                    if (can_auto_init) {
                        self.init(.{ .n_jobs = 1 }) catch |err| {
                            return switch (err) {
                                error.OutOfMemory => error.OutOfMemory,
                                else => error.Unexpected,
                            };
                        };
                    } else {
                        return error.Unexpected;
                    }
                },
            }
            const key = comptime enumOf(func);
            const fieldName = @tagName(key);
            const Call = @FieldType(WorkItem, fieldName);
            const item = switch (@hasField(Call, "generator")) {
                true => @unionInit(WorkItem, fieldName, .{ .args = args, .generator = dest }),
                false => @unionInit(WorkItem, fieldName, .{ .args = args, .promise = dest }),
            };
            try self.queue.push(item);
        }

        pub fn clear(self: *@This()) void {
            switch (self.status) {
                .initialized => {},
                else => return,
            }
            while (self.queue.pull() != null) {}
        }

        pub fn asyncify(comptime self: *@This(), comptime func: anytype) Asyncified(@TypeOf(func)) {
            const FT = @TypeOf(func);
            const Args = std.meta.ArgsTuple(FT);
            const AFT = Asyncified(FT);
            const AsyncArgs = std.meta.ArgsTuple(AFT);
            const async_fn_info = @typeInfo(AFT).@"fn";
            const AsyncRT = async_fn_info.return_type.?;
            const cc = async_fn_info.calling_convention;
            const async_ns = struct {
                fn push(async_args: AsyncArgs) AsyncRT {
                    var args: Args = undefined;
                    inline for (&args, 0..) |*ptr, i| ptr.* = async_args[i];
                    const p_or_g = async_args[async_args.len - 1];
                    return self.push(func, args, p_or_g);
                }
            };
            return fn_transform.spreadArgs(async_ns.push, cc);
        }

        pub fn Promisified(comptime func: anytype) type {
            const FT = @TypeOf(func);
            return switch (@typeInfo(FT)) {
                .@"fn" => Asyncified(FT),
                .enum_literal => switch (func) {
                    .startup => fn (usize, Promise(WaitResult)) InitError!void,
                    .startup1 => fn (Promise(WaitResult)) InitError!void,
                    .shutdown => fn (Promise(void)) void,
                    else => @compileError("Expected .startup, startup1, or shutdown, received ." ++ @tagName(func)),
                },
                else => @compileError("Expected function or enum literal, received " ++ @typeName(FT)),
            };
        }

        pub fn promisify(comptime self: *@This(), comptime func: anytype) Promisified(func) {
            const FT = @TypeOf(func);
            switch (@typeInfo(FT)) {
                .@"fn" => {
                    const PorG = PromiseOrGenerator(@TypeOf(func));
                    if (PorG.internal_type == .generator) {
                        @compileError("Generator function encountered");
                    }
                    return self.asyncify(func);
                },
                .enum_literal => {
                    switch (func) {
                        .startup, .startup1 => {
                            if (std.meta.fields(ThreadStartParams).len > 0) {
                                @compileError("Cannot generate function due to onThreadStart() requiring arguments");
                            }
                            if (std.meta.fields(ThreadEndParams).len > 0) {
                                @compileError("Cannot generate function due to onThreadEnd() requiring arguments");
                            }
                            const f_ns = switch (func == .startup) {
                                true => struct {
                                    fn startup(thread_count: usize, promise: Promise(WaitResult)) !void {
                                        try self.init(.{ .n_jobs = thread_count });
                                        self.waitAsync(promise);
                                    }
                                },
                                false => struct {
                                    fn startup(promise: Promise(WaitResult)) !void {
                                        try self.init(.{ .n_jobs = 1 });
                                        self.waitAsync(promise);
                                    }
                                },
                            };
                            return f_ns.startup;
                        },
                        .shutdown => {
                            const f_ns = struct {
                                fn shutdown(promise: Promise(void)) void {
                                    return self.deinitAsync(promise);
                                }
                            };
                            return f_ns.shutdown;
                        },
                        else => unreachable,
                    }
                },
                else => @compileError("Expected function or enum literal, received " ++ @typeName(FT)),
            }
        }

        pub fn Asyncified(comptime FT: type) type {
            const PorG = PromiseOrGenerator(FT);
            const fn_info = @typeInfo(FT).@"fn";
            const param_count = fn_info.params.len + 1;
            var param_types: [param_count]type = undefined;
            var param_attrs: [param_count]std.builtin.Type.Fn.Param.Attributes = undefined;
            inline for (fn_info.params, 0..) |param, i| {
                param_types[i] = param.type.?;
                param_attrs[i] = .{ .@"noalias" = param.is_noalias };
            }
            param_types[param_count - 1] = PorG;
            param_attrs[param_count - 1] = .{};
            return @Fn(&param_types, &param_attrs, Error!void, .{
                .@"callconv" = fn_info.calling_convention,
            });
        }

        test "Asyncified" {
            const FT1 = Asyncified(fn () void);
            try expectEqual(fn (Promise(void)) Error!void, FT1);
            const FT2 = Asyncified(fn (i32, *anyopaque) error{CheeseMelted}!i64);
            try expectEqual(fn (i32, *anyopaque, Promise(error{CheeseMelted}!i64)) Error!void, FT2);
            const Iterator = struct {
                ptr: *anyopaque,

                pub fn next(_: *@This()) error{CowboyHatesCows}!?i32 {
                    return 0;
                }
            };
            const FT3 = Asyncified(fn () Iterator);
            try expectEqual(fn (Generator(error{CowboyHatesCows}!?i32, false)) Error!void, FT3);
        }

        const def_allocator = switch (builtin.target.cpu.arch.isWasm()) {
            true => std.heap.wasm_allocator,
            false => std.heap.c_allocator,
        };
        const Status = enum {
            uninitialized,
            initialized,
            deinitializing,
        };
        const WaitResult = switch (ThreadStartError) {
            error{} => void,
            else => ThreadStartError!void,
        };
        const WorkItem = init: {
            var fields: [decls.len]struct {
                name: [:0]const u8,
                type: type,
            } = undefined;
            var count = 0;
            for (decls) |decl| {
                const DT = @TypeOf(@field(ns, decl.name));
                switch (@typeInfo(DT)) {
                    .@"fn" => |f| {
                        if (f.return_type) |RT| {
                            // if the return value is an iterator, then a generator is expected
                            // otherwise an optional promise can be provided
                            const Request = if (util.IteratorReturnValue(RT)) |IT| struct {
                                args: std.meta.ArgsTuple(DT),
                                generator: ?Generator(IT, util.isIteratorAllocating(RT)),
                            } else struct {
                                args: std.meta.ArgsTuple(DT),
                                promise: ?Promise(RT),
                            };
                            fields[count] = .{
                                .name = decl.name,
                                .type = Request,
                            };
                            count += 1;
                        }
                    },
                    else => {},
                }
            }
            const TagInt = if (count <= 256) u8 else u16;
            var field_names: [count][]const u8 = undefined;
            var field_types: [count]type = undefined;
            var field_attrs: [count]std.builtin.Type.UnionField.Attributes = undefined;
            var tag_values: [count]TagInt = undefined;
            for (fields[0..count], 0..) |field, i| {
                field_names[i] = field.name;
                field_types[i] = field.type;
                field_attrs[i] = .{};
                tag_values[i] = i;
            }
            const Tag = @Enum(TagInt, .exhaustive, &field_names, &tag_values);
            break :init @Union(.auto, Tag, &field_names, &field_types, &field_attrs);
        };
        const WorkItemEnum = @typeInfo(WorkItem).@"union".tag_type.?;

        fn enumOf(comptime func: anytype) WorkItemEnum {
            return for (decls) |decl| {
                const dv = @field(ns, decl.name);
                if (@TypeOf(dv) == @TypeOf(func)) {
                    if (dv == func) break @field(WorkItemEnum, decl.name);
                }
            } else @compileError("Function not found in " ++ @typeName(ns));
        }

        fn ArgsOf(comptime func: anytype) type {
            return std.meta.ArgsTuple(@TypeOf(func));
        }

        fn PromiseOrGenerator(comptime func: anytype) type {
            const RT = util.ReturnValue(func);
            return if (util.IteratorReturnValue(RT)) |IT|
                Generator(IT, util.isIteratorAllocating(RT))
            else
                Promise(RT);
        }

        fn handleWorkItems(
            self: *@This(),
            thread_start_params: ThreadStartParams,
            thread_end_params: ThreadEndParams,
        ) void {
            var start_succeeded = true;
            if (@hasDecl(ns, "onThreadStart")) {
                const result = @call(.auto, ns.onThreadStart, thread_start_params);
                if (ThreadStartError != error{}) {
                    if (result) |_| {} else |err| {
                        self.init_result = err;
                        start_succeeded = false;
                    }
                }
            }
            if (@atomicRmw(usize, &self.init_remaining, .Sub, 1, .monotonic) == 1) {
                if (@typeInfo(WaitResult) != .error_union or !std.meta.isError(self.init_result)) {
                    self.init_futex.store(1, .release);
                    std.Thread.Futex.wake(&self.init_futex, std.math.maxInt(u32));
                    if (self.init_promise) |promise| promise.resolve(self.init_result);
                } else {
                    // delay reporting error until threads have stopped
                    self.queue.stop();
                }
            }
            while (true) {
                if (self.queue.pull()) |item| {
                    invokeFunction(item);
                } else switch (self.queue.stopped) {
                    false => self.queue.wait(),
                    true => break,
                }
            }
            if (@hasDecl(ns, "onThreadEnd")) {
                if (start_succeeded) _ = @call(.auto, ns.onThreadEnd, thread_end_params);
            }
            if (@atomicRmw(usize, &self.thread_count, .Sub, 1, .monotonic) == 1) {
                self.queue.deinit();
                self.status = .uninitialized;
                if (@typeInfo(WaitResult) == .error_union and std.meta.isError(self.init_result)) {
                    self.init_futex.store(1, .release);
                    std.Thread.Futex.wake(&self.init_futex, std.math.maxInt(u32));
                    if (self.init_promise) |promise| promise.resolve(self.init_result);
                }
                if (self.deinit_promise) |promise| promise.resolve({});
                if (@hasDecl(internal_ns, "onQueueDeinit")) {
                    _ = @call(.auto, internal_ns.onQueueDeinit, .{});
                }
            }
        }

        fn invokeFunction(item: WorkItem) void {
            const un = @typeInfo(WorkItem).@"union";
            inline for (un.fields) |field| {
                const key = @field(WorkItemEnum, field.name);
                if (item == key) {
                    const func = @field(ns, field.name);
                    const call = @field(item, field.name);
                    const result = @call(.auto, func, call.args);
                    switch (@hasField(@TypeOf(call), "generator")) {
                        true => if (call.generator) |g| g.pipe(result),
                        false => if (call.promise) |p| p.resolve(result),
                    }
                }
            }
        }
    };
}

test "WorkQueue.push()" {
    const test_ns = struct {
        var total: i32 = 0;

        pub fn hello(num: i32) void {
            total += num;
        }

        pub fn world() void {}

        pub fn shutdown(futex: *std.atomic.Value(u32), _: void) void {
            futex.store(1, .monotonic);
            std.Thread.Futex.wake(futex, 1);
        }
    };
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue: WorkQueue(test_ns, struct {}) = .{};
    try queue.init(.{ .allocator = gpa.allocator(), .n_jobs = 1 });
    try queue.push(test_ns.hello, .{123}, null);
    try queue.push(test_ns.hello, .{456}, null);
    try queue.push(test_ns.world, .{}, null);
    std.time.sleep(1e+8);
    try expectEqual(123 + 456, test_ns.total);
    var futex: std.atomic.Value(u32) = .init(0);
    queue.deinitAsync(.init(&futex, test_ns.shutdown));
    // wait for thread shutdown
    std.Thread.Futex.wait(&futex, 0);
}

test "WorkQueue.promisify()" {
    const test_ns1 = struct {
        var total: i32 = 0;

        pub fn hello(num: i32) i32 {
            total += num;
            return num;
        }

        pub fn world() error{Doh}!bool {
            return error.Doh;
        }
    };
    const test_ns2 = struct {
        var hello_result: ?i32 = null;
        var world_result: ?bool = null;

        fn hello_callback(_: ?*anyopaque, result: i32) void {
            hello_result = result;
        }

        fn world_callback(_: ?*anyopaque, result: error{Doh}!bool) void {
            world_result = result catch false;
        }

        fn init(allocator: std.mem.Allocator) !void {
            try queue.init(.{ .allocator = allocator, .n_jobs = 1 });
        }

        fn deinit() void {
            var futex: std.atomic.Value(u32) = .init(0);
            queue.deinitAsync(.init(&futex, shutdown));
            // wait for thread shutdown
            std.Thread.Futex.wait(&futex, 0);
        }

        fn shutdown(futex: *std.atomic.Value(u32), _: void) void {
            futex.store(1, .monotonic);
            std.Thread.Futex.wake(futex, 1);
        }

        var queue: WorkQueue(test_ns1, struct {}) = .{};

        pub const hello = queue.promisify(test_ns1.hello);
        pub const world = queue.promisify(test_ns1.world);
    };
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    try test_ns2.init(gpa.allocator());
    const promise1: PromiseOf(test_ns1.hello) = .init(null, test_ns2.hello_callback);
    try test_ns2.hello(1234, promise1);
    const promise2: PromiseOf(test_ns1.world) = .init(null, test_ns2.world_callback);
    try test_ns2.world(promise2);
    std.time.sleep(1e+8);
    try expectEqual(1234, test_ns1.total);
    try expectEqual(1234, test_ns2.hello_result);
    try expectEqual(false, test_ns2.world_result);
    test_ns2.deinit();
}
