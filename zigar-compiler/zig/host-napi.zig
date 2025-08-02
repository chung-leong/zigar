const std = @import("std");
const expectEqual = std.testing.expectEqual;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const exporter = @import("./exporter.zig");
const fn_transform = @import("./fn-transform.zig");
const hooks = @import("./hooks.zig");
const interface = @import("./interface.zig");
const thunk_js = @import("./thunk-js.zig");
const thunk_zig = @import("./thunk-zig.zig");
const types = @import("./types.zig");
const AnyModuleHost = types.AnyModuleHost;
const AnyValue = types.AnyValue;
pub const Promise = types.Promise;
pub const PromiseOf = types.PromiseOf;
pub const PromiseArgOf = types.PromiseArgOf;
pub const Generator = types.Generator;
pub const GeneratorOf = types.GeneratorOf;
pub const GeneratorArgOf = types.GeneratorArgOf;
pub const AbortSignal = types.AbortSignal;

const Module = interface.Module(AnyModuleHost, AnyValue);

pub fn WorkQueue(ns: type) type {
    return types.WorkQueue(ns, struct {
        pub fn onQueueInit() !void {
            try startMultithread();
        }

        pub fn onQueueDeinit() void {
            stopMultithread();
        }
    });
}

fn missing(comptime T: type) comptime_int {
    return std.math.maxInt(T);
}

const MainThread = struct {
    thread_id: std.Thread.Id,
    module_data: *AnyModuleHost,
    multithread_count: std.atomic.Value(usize),
    redirection_mask: hooks.Mask = .{},
};

var gpa = std.heap.DebugAllocator(.{}).init;
const allocator = gpa.allocator();
var main_thread_list = std.ArrayList(*MainThread).init(allocator);
var imports: Module.Imports = undefined;

threadlocal var main_thread: ?MainThread = null;
threadlocal var parent_thread_id: ?std.Thread.Id = null;

pub fn setParentThreadId(id: std.Thread.Id) void {
    parent_thread_id = id;
}

fn getModuleData() !*AnyModuleHost {
    return if (main_thread) |mt| mt.module_data else error.NotInMainThread;
}

fn getMainThread() !std.meta.Tuple(&.{ *MainThread, bool }) {
    if (main_thread) |*mt| {
        return .{ mt, true };
    } else if (parent_thread_id) |tid| {
        for (main_thread_list.items) |mt| {
            if (mt.thread_id == tid) return .{ mt, false };
        }
    } else {
        if (main_thread_list.getLastOrNull()) |mt| {
            return .{ mt, false };
        }
    }
    return error.MainThreadNotFound;
}

pub fn createBool(initializer: bool) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.create_bool(md, initializer, &value) != .SUCCESS) {
        return error.UnableToCreateBoolean;
    }
    return value;
}

pub fn createInteger(initializer: i32, is_unsigned: bool) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.create_integer(md, initializer, is_unsigned, &value) != .SUCCESS) {
        return error.UnableToCreateInteger;
    }
    return value;
}

pub fn createBigInteger(initializer: i64, is_unsigned: bool) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.create_big_integer(md, initializer, is_unsigned, &value) != .SUCCESS) {
        return error.UnableToCreateInteger;
    }
    return value;
}

pub fn createString(initializer: []const u8) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.create_string(md, initializer.ptr, initializer.len, &value) != .SUCCESS) {
        return error.UnableToCreateString;
    }
    return value;
}

pub fn createView(bytes: ?[*]const u8, len: usize, copying: bool, export_handle: ?usize) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.create_view(md, bytes, len, copying, export_handle orelse 0, &value) != .SUCCESS) {
        return error.UnableToCreateDataView;
    }
    return value;
}

pub fn createInstance(structure: AnyValue, dv: AnyValue, slots: ?AnyValue) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.create_instance(md, structure, dv, slots, &value) != .SUCCESS) {
        return error.UnableToCreateStructureInstance;
    }
    return value;
}

pub fn createTemplate(dv: ?AnyValue, slots: ?AnyValue) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.create_template(md, dv, slots, &value) != .SUCCESS) {
        return error.UnableToCreateTemplate;
    }
    return value;
}

pub fn createList() !AnyValue {
    const md = try getModuleData();
    var list: AnyValue = undefined;
    if (imports.create_list(md, &list) != .SUCCESS) {
        return error.UnableToCreateList;
    }
    return list;
}

pub fn createObject() !AnyValue {
    const md = try getModuleData();
    var object: AnyValue = undefined;
    if (imports.create_object(md, &object) != .SUCCESS) {
        return error.UnableToCreateObject;
    }
    return object;
}

pub fn getProperty(object: AnyValue, key: []const u8) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.get_property(md, object, key.ptr, key.len, &value) != .SUCCESS) {
        return error.UnableToGetProperty;
    }
    return value;
}

pub fn setProperty(object: AnyValue, key: []const u8, value: AnyValue) !void {
    const md = try getModuleData();
    if (imports.set_property(md, object, key.ptr, key.len, value) != .SUCCESS) {
        return error.UnableToSetProperty;
    }
}

pub fn getSlotValue(object: ?AnyValue, slot: usize) !AnyValue {
    const md = try getModuleData();
    var value: AnyValue = undefined;
    if (imports.get_slot_value(md, object, slot, &value) != .SUCCESS) {
        return error.UnableToGetSlotValue;
    }
    return value;
}

pub fn setSlotValue(object: ?AnyValue, slot: usize, value: AnyValue) !void {
    const md = try getModuleData();
    if (imports.set_slot_value(md, object, slot, value) != .SUCCESS) {
        return error.UnableToSetSlotValue;
    }
}

pub fn appendList(list: AnyValue, value: AnyValue) !void {
    const md = try getModuleData();
    if (imports.append_list(md, list, value) != .SUCCESS) {
        return error.UnableToAppendList;
    }
}

pub fn getExportHandle(comptime ptr: anytype) usize {
    const ns = struct {
        fn getAddress() usize {
            return @intFromPtr(ptr);
        }
    };
    return @intFromPtr(&ns.getAddress);
}

pub fn beginStructure(structure: AnyValue) !void {
    const md = try getModuleData();
    if (imports.begin_structure(md, structure) != .SUCCESS) {
        return error.UnableToDefineStructure;
    }
}

pub fn finishStructure(structure: AnyValue) !void {
    const md = try getModuleData();
    if (imports.finish_structure(md, structure) != .SUCCESS) {
        return error.UnableToDefineStructure;
    }
}

pub fn handleJscall(ptr: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E {
    const md: *AnyModuleHost = @ptrCast(ptr);
    const in_main_thread = main_thread != null;
    var call: Module.Jscall = .{
        .fn_id = fn_id,
        .arg_address = @intFromPtr(arg_ptr),
        .arg_size = arg_size,
    };
    return imports.handle_jscall(md, &call, in_main_thread);
}

pub fn releaseFunction(fn_ptr: anytype) void {
    const FT = types.FnPointerTarget(@TypeOf(fn_ptr));
    const thunk_address = @intFromPtr(fn_ptr);
    const control = thunk_js.createThunkController(@This(), FT);
    const fn_id = control(null, .get_id, thunk_address) catch return;
    const ptr_address = control(null, .get_ptr, thunk_address) catch return;
    const md: *AnyModuleHost = @ptrFromInt(ptr_address);
    const in_main_thread = main_thread != null;
    _ = imports.release_function(md, fn_id, in_main_thread);
}

pub fn startMultithread() !void {
    const mt, const in_main_thread = try getMainThread();
    const prev_count = mt.multithread_count.fetchAdd(1, .monotonic);
    errdefer _ = mt.multithread_count.fetchSub(1, .monotonic);
    if (prev_count == 0) {
        if (imports.enable_multithread(mt.module_data, in_main_thread) != .SUCCESS) {
            return error.UnableToUseThread;
        }
    }
}

pub fn stopMultithread() void {
    const mt, const in_main_thread = getMainThread() catch return;
    const prev_count = mt.multithread_count.fetchSub(1, .monotonic);
    if (prev_count == 1) {
        _ = imports.disable_multithread(mt.module_data, in_main_thread);
    }
}

fn initialize(md: *AnyModuleHost) callconv(.C) E {
    main_thread = .{
        .thread_id = std.Thread.getCurrentId(),
        .module_data = md,
        .multithread_count = std.atomic.Value(usize).init(0),
    };
    main_thread_list.append(&main_thread.?) catch return .NOMEM;
    return .SUCCESS;
}

fn deinitialize() callconv(.C) E {
    for (main_thread_list.items, 0..) |mt, index| {
        if (mt == &main_thread.?) {
            _ = main_thread_list.swapRemove(index);
            return .SUCCESS;
        }
    }
    main_thread = null;
    return .NOENT;
}

pub fn getExportAddress(handle: usize, dest: *usize) callconv(.C) E {
    const f: *const fn () usize = @ptrFromInt(handle);
    dest.* = f();
    return .SUCCESS;
}

const empty_ptr: *anyopaque = @constCast(@ptrCast(&.{}));

fn runThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
) callconv(.C) E {
    const thunk: thunk_zig.Thunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    return if (thunk(fn_ptr, arg_ptr)) .SUCCESS else |_| .FAULT;
}

fn runVariadicThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
    attr_address: usize,
    arg_count: usize,
) callconv(.C) E {
    const thunk: thunk_zig.VariadicThunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    const attr_ptr: *const anyopaque = @ptrFromInt(attr_address);
    return if (thunk(fn_ptr, arg_ptr, attr_ptr, arg_count)) .SUCCESS else |_| .FAULT;
}

fn createJsThunk(
    controller_address: usize,
    fn_id: usize,
    dest: *usize,
) callconv(.C) E {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    const md = getModuleData() catch return .FAULT;
    const thunk_address = controller(md, .create, fn_id) catch return .FAULT;
    dest.* = thunk_address;
    return .SUCCESS;
}

fn destroyJsThunk(
    controller_address: usize,
    fn_address: usize,
    dest: *usize,
) callconv(.C) E {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    const md = getModuleData() catch return .FAULT;
    const fn_id = controller(md, .destroy, fn_address) catch return .FAULT;
    dest.* = fn_id;
    return .SUCCESS;
}

fn setSyscallMask(name: [*:0]const u8, set: bool) callconv(.C) E {
    const mt, _ = getMainThread() catch return .FAULT;
    const name_slice = name[0..std.mem.len(name)];
    const count_before = countEventHandlers(mt.redirection_mask);
    return inline for (std.meta.fields(hooks.Mask)) |field| {
        if (std.mem.eql(u8, field.name, name_slice)) {
            @field(mt.redirection_mask, field.name) = set;
            const count_after = countEventHandlers(mt.redirection_mask);
            if (count_before == 0 and count_after != 0) {
                _ = imports.enable_syscall_trap(mt.module_data);
            } else if (count_before != 0 and count_after == 0) {
                _ = imports.disable_syscall_trap(mt.module_data);
            }
            break .SUCCESS;
        }
    } else .INVAL;
}

fn countEventHandlers(mask: hooks.Mask) usize {
    var count: usize = 0;
    inline for (std.meta.fields(hooks.Mask)) |field| {
        if (@field(mask, field.name)) {
            count += 1;
        }
    }
    return count;
}

const hook_table = hooks.getHookTable(@This());

fn getSyscallHook(name: [*:0]const u8, dest: *hooks.Entry) callconv(.C) E {
    const name_s = name[0..std.mem.len(name)];
    const entry = hook_table.get(name_s) orelse return .NOENT;
    dest.* = entry;
    return .SUCCESS;
}

pub fn redirectSyscall(call: *hooks.Syscall) std.posix.E {
    const mt, const in_main_thread = getMainThread() catch return .FAULT;
    const md = mt.module_data;
    return imports.handle_syscall(md, call, in_main_thread);
}

pub fn isRedirecting(comptime literal: @TypeOf(.enum_literal)) bool {
    const mt, _ = getMainThread() catch return false;
    const name = @tagName(literal);
    return @field(mt.redirection_mask, name);
}

pub fn createModule(comptime module_ns: type) Module {
    const host = @This();
    const ns = struct {
        fn getFactoryThunk(dest: *usize) callconv(.C) E {
            dest.* = @intFromPtr(exporter.getFactoryThunk(host, module_ns));
            return .SUCCESS;
        }
    };
    return .{
        .version = 6,
        .attributes = .{
            .little_endian = builtin.target.cpu.arch.endian() == .little,
            .runtime_safety = switch (builtin.mode) {
                .Debug, .ReleaseSafe => true,
                else => false,
            },
            .libc = builtin.link_libc,
        },
        .imports = &imports,
        .exports = &.{
            .initialize = initialize,
            .deinitialize = deinitialize,
            .get_export_address = getExportAddress,
            .get_factory_thunk = ns.getFactoryThunk,
            .run_thunk = runThunk,
            .run_variadic_thunk = runVariadicThunk,
            .create_js_thunk = createJsThunk,
            .destroy_js_thunk = destroyJsThunk,
            .get_syscall_hook = getSyscallHook,
            .set_syscall_mask = setSyscallMask,
        },
    };
}

test "createModule" {
    const Test = struct {
        pub const a: i32 = 1;
        const b: i32 = 2;
        pub var c: bool = true;
        pub const d: f64 = 3.14;
        pub const e: [4]i32 = .{ 3, 4, 5, 6 };
        pub const f = enum { dog, cat, chicken };
        pub const g = enum(c_int) { dog = -100, cat, chicken };
        pub fn h(arg1: i32, arg2: i32) bool {
            return arg1 < arg2;
        }
    };
    const m = createModule(Test);
    try expectEqual(4, m.version);
    try expectEqual((builtin.target.cpu.arch.endian() == .little), m.attributes.little_endian);
}
