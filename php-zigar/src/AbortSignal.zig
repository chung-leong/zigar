const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("ByteBuffer.zig");
const CallDispatcher = @import("CallDispatcher.zig");
const failure = @import("failure.zig");
const io = @import("system.zig").io;
const ModuleHost = @import("host.zig").ModuleHost;
const php_ng = @import("php/root.zig");
const Class = php_ng.Class;
const Function = php_ng.Function;
const Object = php_ng.Object;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;

pub const @"struct" = Object.Custom(struct {
    value: std.atomic.Value(u32) align(@sizeOf(*anyopaque)) = .init(0),

    pub fn @"call abort"(self: *@This(), _: struct {}) !void {
        self.value.store(1, .monotonic);
        std.Io.futexWake(io, u32, &self.value.raw, std.math.maxInt(u32));
    }

    pub fn @"call timeout"(self: *@This(), args: struct { seconds: f64 }) !void {
        try CallDispatcher.event_loop.addTimeout(args.seconds, self);
    }

    pub fn @"call __construct"(self: *@This(), args: struct { timeout: ?f64 }) !void() {
        if (args.timeout) |seconds| {
            try CallDispatcher.event_loop.addTimeout(seconds, self);
        }
    }
});
