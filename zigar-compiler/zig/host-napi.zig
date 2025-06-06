const std = @import("std");
const expectEqual = std.testing.expectEqual;
const builtin = @import("builtin");

const exporter = @import("exporter.zig");
const thunk_js = @import("thunk-js.zig");
const thunk_zig = @import("thunk-zig.zig");
const types = @import("types.zig");
const Value = types.Value;
const Result = types.Result;
const Memory = types.Memory;
const Error = types.Error;
pub const Promise = types.Promise;
pub const PromiseOf = types.PromiseOf;
pub const PromiseArgOf = types.PromiseArgOf;
pub const Generator = types.Generator;
pub const GeneratorOf = types.GeneratorOf;
pub const GeneratorArgOf = types.GeneratorArgOf;
pub const AbortSignal = types.AbortSignal;

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

const ModuleData = opaque {};

// struct for C
const StructureC = extern struct {
    name: ?[*:0]const u8,
    type: u32,
    purpose: u32,
    flags: u32,
    signature: u64,
    length: usize,
    byte_size: usize,
    alignment: u16,
};
const MemberC = extern struct {
    name: ?[*:0]const u8,
    type: u32,
    flags: u32,
    bit_offset: usize,
    bit_size: usize,
    byte_size: usize,
    slot: usize,
    structure: ?Value,
};

fn missing(comptime T: type) comptime_int {
    return std.math.maxInt(T);
}

const Futex = struct {
    value: std.atomic.Value(u32),
    handle: usize = undefined,
};

const JSCall = struct {
    fn_id: usize,
    arg_address: usize,
    arg_size: usize,
    futex_handle: usize,
};

const MainThread = struct {
    thread_id: std.Thread.Id,
    module_data: *ModuleData,
    multithread_count: std.atomic.Value(usize),
};

var gpa = std.heap.DebugAllocator(.{}).init;
const allocator = gpa.allocator();
var main_thread_list = std.ArrayList(*MainThread).init(allocator);
var imports: Imports = undefined;

threadlocal var main_thread: ?MainThread = null;
threadlocal var parent_thread_id: ?std.Thread.Id = null;

pub fn setParentThreadId(id: std.Thread.Id) void {
    parent_thread_id = id;
}

fn getModuleData() !*ModuleData {
    return if (main_thread) |mt| mt.module_data else Error.NotInMainThread;
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
    return Error.MainThreadNotFound;
}

pub fn captureString(memory: Memory) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.capture_string(md, &memory, &value) != .ok) {
        return Error.UnableToCreateObject;
    }
    return value;
}

pub fn captureView(memory: Memory, export_handle: ?usize) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.capture_view(md, &memory, export_handle orelse 0, &value) != .ok) {
        return Error.UnableToCreateDataView;
    }
    return value;
}

pub fn castView(memory: Memory, structure: Value, export_handle: ?usize) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.cast_view(md, &memory, structure, export_handle orelse 0, &value) != .ok) {
        return Error.UnableToCreateObject;
    }
    return value;
}

pub fn getExportHandle(comptime ptr: anytype) usize {
    const ns = struct {
        fn getAddress() usize {
            return @intFromPtr(ptr);
        }
    };
    return @intFromPtr(&ns.getAddress);
}

pub fn readSlot(target: ?Value, id: usize) !Value {
    const md = try getModuleData();
    var result: Value = undefined;
    if (imports.read_slot(md, target, id, &result) != .ok) {
        return Error.UnableToRetrieveObject;
    }
    return result;
}

pub fn writeSlot(target: ?Value, id: usize, value: ?Value) !void {
    const md = try getModuleData();
    if (imports.write_slot(md, target, id, value) != .ok) {
        return Error.UnableToInsertObject;
    }
}

pub fn beginStructure(def: types.Structure) !Value {
    const md = try getModuleData();
    const def_c: StructureC = .{
        .name = if (def.name) |p| @ptrCast(p) else null,
        .type = @intFromEnum(def.type),
        .purpose = @intFromEnum(def.purpose),
        .flags = @bitCast(def.flags),
        .signature = def.signature,
        .length = def.length orelse missing(usize),
        .byte_size = def.byte_size orelse missing(usize),
        .alignment = def.alignment orelse missing(u16),
    };
    var structure: Value = undefined;
    if (imports.begin_structure(md, &def_c, &structure) != .ok) {
        return Error.UnableToStartStructureDefinition;
    }
    return structure;
}

pub fn attachMember(structure: Value, member: types.Member, is_static: bool) !void {
    const md = try getModuleData();
    const member_c: MemberC = .{
        .name = if (member.name) |p| @ptrCast(p) else null,
        .type = @intFromEnum(member.type),
        .flags = @bitCast(member.flags),
        .bit_offset = member.bit_offset orelse missing(usize),
        .bit_size = member.bit_size orelse missing(usize),
        .byte_size = member.byte_size orelse missing(usize),
        .slot = member.slot orelse missing(usize),
        .structure = member.structure,
    };
    if (imports.attach_member(md, structure, &member_c, is_static) != .ok) {
        if (is_static) {
            return Error.UnableToAddStaticMember;
        } else {
            return Error.UnableToAddStructureMember;
        }
    }
}

pub fn attachTemplate(structure: Value, template: Value, is_static: bool) !void {
    const md = try getModuleData();
    if (imports.attach_template(md, structure, template, is_static) != .ok) {
        return Error.UnableToAddStructureTemplate;
    }
}

pub fn defineStructure(structure: Value) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.define_structure(md, structure, &value) != .ok) {
        return Error.UnableToDefineStructure;
    }
    return value;
}

pub fn endStructure(structure: Value) !void {
    const md = try getModuleData();
    if (imports.end_structure(md, structure) != .ok) {
        return Error.UnableToDefineStructure;
    }
}

pub fn createTemplate(dv: ?Value) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.create_template(md, dv, &value) != .ok) {
        return Error.UnableToCreateStructureTemplate;
    }
    return value;
}

pub fn createMessage(err: anyerror) ?Value {
    const err_name = @errorName(err);
    const memory = Memory.from(err_name, true);
    return captureString(memory) catch null;
}

pub fn handleJsCall(ptr: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) Result {
    const md: *ModuleData = @ptrCast(ptr);
    const in_main_thread = main_thread != null;
    const initial_value = 0xffff_ffff;
    var futex: Futex = undefined;
    const call: JSCall = .{
        .fn_id = fn_id,
        .arg_address = @intFromPtr(arg_ptr),
        .arg_size = arg_size,
        .futex_handle = switch (in_main_thread) {
            true => 0,
            false => init: {
                futex.value = std.atomic.Value(u32).init(initial_value);
                futex.handle = @intFromPtr(&futex);
                break :init futex.handle;
            },
        },
    };
    var result = imports.handle_js_call(md, &call, in_main_thread);
    if (!in_main_thread and result == .ok) {
        std.Thread.Futex.wait(&futex.value, initial_value);
        result = @enumFromInt(futex.value.load(.acquire));
    }
    return result;
}

pub fn releaseFunction(fn_ptr: anytype) void {
    const FT = types.FnPointerTarget(@TypeOf(fn_ptr));
    const thunk_address = @intFromPtr(fn_ptr);
    const control = thunk_js.createThunkController(@This(), FT);
    const fn_id = control(null, .get_id, thunk_address) catch return;
    const ptr_address = control(null, .get_ptr, thunk_address) catch return;
    const md: *ModuleData = @ptrFromInt(ptr_address);
    const in_main_thread = main_thread != null;
    _ = imports.release_function(md, fn_id, in_main_thread);
}

pub fn startMultithread() !void {
    const mt, const in_main_thread = try getMainThread();
    const prev_count = mt.multithread_count.fetchAdd(1, .monotonic);
    errdefer _ = mt.multithread_count.fetchSub(1, .monotonic);
    if (prev_count == 0) {
        if (imports.enable_multithread(mt.module_data, in_main_thread) != .ok) {
            return Error.UnableToUseThread;
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

fn initialize(md: *ModuleData) callconv(.C) Result {
    main_thread = .{
        .thread_id = std.Thread.getCurrentId(),
        .module_data = md,
        .multithread_count = std.atomic.Value(usize).init(0),
    };
    main_thread_list.append(&main_thread.?) catch return .failure;
    return .ok;
}

fn deinitialize() callconv(.C) Result {
    for (main_thread_list.items, 0..) |mt, index| {
        if (mt == &main_thread.?) {
            _ = main_thread_list.swapRemove(index);
            return .ok;
        }
    }
    main_thread = null;
    return .failure;
}

fn overrideWrite(bytes: [*]const u8, len: usize) callconv(.C) Result {
    const mt, const in_main_thread = getMainThread() catch return .failure;
    const md = mt.module_data;
    const memory: Memory = .{ .bytes = @constCast(bytes), .len = len };
    return imports.write_bytes(md, &memory, in_main_thread);
}

pub fn getExportAddress(handle: usize, dest: *usize) callconv(.C) Result {
    const f: *const fn () usize = @ptrFromInt(handle);
    dest.* = f();
    return .ok;
}

const empty_ptr: *anyopaque = @constCast(@ptrCast(&.{}));

fn runThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
) callconv(.C) Result {
    const thunk: thunk_zig.Thunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    return if (thunk(fn_ptr, arg_ptr)) .ok else |_| .failure;
}

fn runVariadicThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
    attr_address: usize,
    arg_count: usize,
) callconv(.C) Result {
    const thunk: thunk_zig.VariadicThunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    const attr_ptr: *const anyopaque = @ptrFromInt(attr_address);
    return if (thunk(fn_ptr, arg_ptr, attr_ptr, arg_count)) .ok else |_| .failure;
}

fn createJsThunk(
    controller_address: usize,
    fn_id: usize,
    dest: *usize,
) callconv(.C) Result {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    const md = getModuleData() catch return .failure;
    const thunk_address = controller(md, .create, fn_id) catch return .failure;
    dest.* = thunk_address;
    return .ok;
}

fn destroyJsThunk(
    controller_address: usize,
    fn_address: usize,
    dest: *usize,
) callconv(.C) Result {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    const md = getModuleData() catch return .failure;
    const fn_id = controller(md, .destroy, fn_address) catch return .failure;
    dest.* = fn_id;
    return .ok;
}

fn wakeCaller(futex_handle: usize, value: u32) callconv(.C) Result {
    // make sure futex address is valid
    const ptr: *Futex = @ptrFromInt(futex_handle);
    if (ptr.handle != futex_handle) return .failure;
    ptr.value.store(value, .release);
    std.Thread.Futex.wake(&ptr.value, 1);
    return .ok;
}

// pointer table that's filled on the C side
const Imports = extern struct {
    capture_string: *const fn (*ModuleData, *const Memory, *Value) callconv(.C) Result,
    capture_view: *const fn (*ModuleData, *const Memory, usize, *Value) callconv(.C) Result,
    cast_view: *const fn (*ModuleData, *const Memory, Value, usize, *Value) callconv(.C) Result,
    read_slot: *const fn (*ModuleData, ?Value, usize, *Value) callconv(.C) Result,
    write_slot: *const fn (*ModuleData, ?Value, usize, ?Value) callconv(.C) Result,
    begin_structure: *const fn (*ModuleData, *const StructureC, *Value) callconv(.C) Result,
    attach_member: *const fn (*ModuleData, Value, *const MemberC, bool) callconv(.C) Result,
    attach_template: *const fn (*ModuleData, Value, Value, bool) callconv(.C) Result,
    define_structure: *const fn (*ModuleData, Value, *Value) callconv(.C) Result,
    end_structure: *const fn (*ModuleData, Value) callconv(.C) Result,
    create_template: *const fn (*ModuleData, ?Value, *Value) callconv(.C) Result,
    enable_multithread: *const fn (*ModuleData, bool) callconv(.C) Result,
    disable_multithread: *const fn (*ModuleData, bool) callconv(.C) Result,
    handle_js_call: *const fn (*ModuleData, *const JSCall, bool) callconv(.C) Result,
    release_function: *const fn (*ModuleData, usize, bool) callconv(.C) Result,
    write_bytes: *const fn (*ModuleData, *const Memory, bool) callconv(.C) Result,
};

// pointer table that's used on the C side
const Exports = extern struct {
    initialize: *const fn (*ModuleData) callconv(.C) Result,
    deinitialize: *const fn () callconv(.C) Result,
    get_export_address: *const fn (usize, *usize) callconv(.C) Result,
    get_factory_thunk: *const fn (*usize) callconv(.C) Result,
    run_thunk: *const fn (usize, usize, usize) callconv(.C) Result,
    run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.C) Result,
    create_js_thunk: *const fn (usize, usize, *usize) callconv(.C) Result,
    destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.C) Result,
    override_write: *const fn ([*]const u8, usize) callconv(.C) Result,
    wake_caller: *const fn (usize, u32) callconv(.C) Result,
};

const Module = extern struct {
    version: u32,
    attributes: types.ModuleAttributes,
    imports: *Imports = &imports,
    exports: *const Exports,
};

pub fn createModule(comptime module: type) Module {
    const host = @This();
    const ns = struct {
        fn getFactoryThunk(dest: *usize) callconv(.C) Result {
            dest.* = @intFromPtr(exporter.getFactoryThunk(host, module));
            return .ok;
        }
    };
    return .{
        .version = 5,
        .attributes = exporter.getModuleAttributes(),
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
            .override_write = overrideWrite,
            .wake_caller = wakeCaller,
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
    const module = createModule(Test);
    try expectEqual(4, module.version);
    try expectEqual((builtin.target.cpu.arch.endian() == .little), module.attributes.little_endian);
}
