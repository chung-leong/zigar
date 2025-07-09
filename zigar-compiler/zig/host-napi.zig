const std = @import("std");
const expectEqual = std.testing.expectEqual;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const exporter = @import("exporter.zig");
const thunk_js = @import("thunk-js.zig");
const thunk_zig = @import("thunk-zig.zig");
const types = @import("types.zig");
const Value = types.Value;
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

const ModuleHost = opaque {};

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

const Jscall = extern struct {
    fn_id: usize,
    arg_address: usize,
    arg_size: usize,
    futex_handle: usize = 0,
};

const Syscall = opaque {};

const MainThread = struct {
    thread_id: std.Thread.Id,
    module_data: *ModuleHost,
    multithread_count: std.atomic.Value(usize),
    redirection_mask: u32 = 0,
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

fn getModuleData() !*ModuleHost {
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
    if (imports.capture_string(md, &memory, &value) != .SUCCESS) {
        return Error.UnableToCreateObject;
    }
    return value;
}

pub fn captureView(memory: Memory, export_handle: ?usize) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.capture_view(md, &memory, export_handle orelse 0, &value) != .SUCCESS) {
        return Error.UnableToCreateDataView;
    }
    return value;
}

pub fn castView(memory: Memory, structure: Value, export_handle: ?usize) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.cast_view(md, &memory, structure, export_handle orelse 0, &value) != .SUCCESS) {
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
    if (imports.read_slot(md, target, id, &result) != .SUCCESS) {
        return Error.UnableToRetrieveObject;
    }
    return result;
}

pub fn writeSlot(target: ?Value, id: usize, value: ?Value) !void {
    const md = try getModuleData();
    if (imports.write_slot(md, target, id, value) != .SUCCESS) {
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
    if (imports.begin_structure(md, &def_c, &structure) != .SUCCESS) {
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
    if (imports.attach_member(md, structure, &member_c, is_static) != .SUCCESS) {
        if (is_static) {
            return Error.UnableToAddStaticMember;
        } else {
            return Error.UnableToAddStructureMember;
        }
    }
}

pub fn attachTemplate(structure: Value, template: Value, is_static: bool) !void {
    const md = try getModuleData();
    if (imports.attach_template(md, structure, template, is_static) != .SUCCESS) {
        return Error.UnableToAddStructureTemplate;
    }
}

pub fn defineStructure(structure: Value) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.define_structure(md, structure, &value) != .SUCCESS) {
        return Error.UnableToDefineStructure;
    }
    return value;
}

pub fn endStructure(structure: Value) !void {
    const md = try getModuleData();
    if (imports.end_structure(md, structure) != .SUCCESS) {
        return Error.UnableToDefineStructure;
    }
}

pub fn createTemplate(dv: ?Value) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.create_template(md, dv, &value) != .SUCCESS) {
        return Error.UnableToCreateStructureTemplate;
    }
    return value;
}

pub fn createMessage(err: anyerror) ?Value {
    const err_name = @errorName(err);
    const memory = Memory.from(err_name, true);
    return captureString(memory) catch null;
}

pub fn handleJscall(ptr: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E {
    const md: *ModuleHost = @ptrCast(ptr);
    const in_main_thread = main_thread != null;
    var call: Jscall = .{
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
    const md: *ModuleHost = @ptrFromInt(ptr_address);
    const in_main_thread = main_thread != null;
    _ = imports.release_function(md, fn_id, in_main_thread);
}

pub fn startMultithread() !void {
    const mt, const in_main_thread = try getMainThread();
    const prev_count = mt.multithread_count.fetchAdd(1, .monotonic);
    errdefer _ = mt.multithread_count.fetchSub(1, .monotonic);
    if (prev_count == 0) {
        if (imports.enable_multithread(mt.module_data, in_main_thread) != .SUCCESS) {
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

fn initialize(md: *ModuleHost) callconv(.C) E {
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

fn redirectSyscall(call: *Syscall) callconv(.C) E {
    const mt, const in_main_thread = getMainThread() catch return .FAULT;
    const md = mt.module_data;
    return imports.handle_syscall(md, call, in_main_thread);
}

fn isRedirecting(op: u32) callconv(.C) bool {
    const mt, _ = getMainThread() catch return false;
    return (mt.redirection_mask & op) != 0;
}

fn setSyscallMask(mask: u32, set: bool) callconv(.C) E {
    const mt, _ = getMainThread() catch return .FAULT;
    if (set) {
        mt.redirection_mask |= mask;
    } else {
        mt.redirection_mask &= ~mask;
    }
    return .SUCCESS;
}

fn getSyscallHook(name: [*:0]const u8, dest: **const anyopaque) callconv(.C) E {
    const fn_ptr = findHook(name) orelse return .NOENT;
    dest.* = fn_ptr;
    return .SUCCESS;
}

const findHook = @extern(*const fn ([*:0]const u8) callconv(.C) ?*const anyopaque, .{ .name = "find_hook" });
comptime {
    @export(&redirectSyscall, .{ .name = "redirect_syscall" });
    @export(&isRedirecting, .{ .name = "is_redirecting" });
}

// pointer table that's filled on the C side
const Imports = extern struct {
    capture_string: *const fn (*ModuleHost, *const Memory, *Value) callconv(.C) E,
    capture_view: *const fn (*ModuleHost, *const Memory, usize, *Value) callconv(.C) E,
    cast_view: *const fn (*ModuleHost, *const Memory, Value, usize, *Value) callconv(.C) E,
    read_slot: *const fn (*ModuleHost, ?Value, usize, *Value) callconv(.C) E,
    write_slot: *const fn (*ModuleHost, ?Value, usize, ?Value) callconv(.C) E,
    begin_structure: *const fn (*ModuleHost, *const StructureC, *Value) callconv(.C) E,
    attach_member: *const fn (*ModuleHost, Value, *const MemberC, bool) callconv(.C) E,
    attach_template: *const fn (*ModuleHost, Value, Value, bool) callconv(.C) E,
    define_structure: *const fn (*ModuleHost, Value, *Value) callconv(.C) E,
    end_structure: *const fn (*ModuleHost, Value) callconv(.C) E,
    create_template: *const fn (*ModuleHost, ?Value, *Value) callconv(.C) E,
    enable_multithread: *const fn (*ModuleHost, bool) callconv(.C) E,
    disable_multithread: *const fn (*ModuleHost, bool) callconv(.C) E,
    handle_jscall: *const fn (*ModuleHost, *Jscall, bool) callconv(.C) E,
    handle_syscall: *const fn (*ModuleHost, *Syscall, bool) callconv(.C) E,
    release_function: *const fn (*ModuleHost, usize, bool) callconv(.C) E,
};

// pointer table that's used on the C side
const Exports = extern struct {
    initialize: *const fn (*ModuleHost) callconv(.C) E,
    deinitialize: *const fn () callconv(.C) E,
    get_export_address: *const fn (usize, *usize) callconv(.C) E,
    get_factory_thunk: *const fn (*usize) callconv(.C) E,
    run_thunk: *const fn (usize, usize, usize) callconv(.C) E,
    run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.C) E,
    create_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
    destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
    get_syscall_hook: *const fn ([*:0]const u8, **const anyopaque) callconv(.C) E,
    set_syscall_mask: *const fn (u32, bool) callconv(.C) E,
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
        fn getFactoryThunk(dest: *usize) callconv(.C) E {
            dest.* = @intFromPtr(exporter.getFactoryThunk(host, module));
            return .SUCCESS;
        }
    };
    return .{
        .version = 6,
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
    const module = createModule(Test);
    try expectEqual(4, module.version);
    try expectEqual((builtin.target.cpu.arch.endian() == .little), module.attributes.little_endian);
}
