const std = @import("std");

pub const Caller = struct {
    module: [:0]const u8,
    fn_name: [:0]const u8,
    file: [:0]const u8,
    line: u32,
    column: u32,

    pub fn deinit(self: *@This(), allocator: std.mem.Allocator) void {
        allocator.free(self.file);
        allocator.destroy(self);
    }
};

pub fn getCaller(allocator: std.mem.Allocator, depth: usize) ?*Caller {
    const start_addr: ?usize = null;
    const debug_info = std.debug.getSelfDebugInfo() catch return null;
    var context: std.debug.ThreadContext = undefined;
    const has_context = std.debug.getContext(&context);
    var it = retry: switch (has_context) {
        true => std.debug.StackIterator.initWithContext(start_addr, debug_info, &context) catch continue :retry false,
        false => std.debug.StackIterator.init(start_addr, null),
    };
    defer it.deinit();
    var current_depth: usize = 0;
    while (it.next()) |return_address| {
        defer current_depth += 1;
        if (current_depth == depth) {
            const address = return_address -| 1;
            const module = debug_info.getModuleForAddress(address) catch return null;
            const symbol_info = module.getSymbolAtAddress(allocator, address) catch return null;
            const loc = symbol_info.source_location orelse return null;
            const caller = allocator.create(Caller) catch return null;
            caller.* = .{
                .module = @ptrCast(symbol_info.compile_unit_name),
                .fn_name = @ptrCast(symbol_info.name),
                .file = @ptrCast(loc.file_name),
                .line = @intCast(loc.line),
                .column = @intCast(loc.column),
            };
            return caller;
        }
    }
    return null;
}
