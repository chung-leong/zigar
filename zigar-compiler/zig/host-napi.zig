const std = @import("std");
const builtin = @import("builtin");
const exporter = @import("exporter.zig");
const types = @import("types.zig");
const thunk_zig = @import("thunk-zig.zig");
const thunk_js = @import("thunk-js.zig");
const expect = std.testing.expect;

const Value = types.Value;
const MemoryType = types.MemoryType;
const Memory = types.Memory;
const Error = types.Error;

pub const Promise = types.Promise;
pub const AbortSignal = types.AbortSignal;

const ModuleData = opaque {};

// struct for C
const StructureC = extern struct {
    name: ?[*:0]const u8,
    type: types.StructureType,
    flags: types.StructureFlags,
    length: usize,
    byte_size: usize,
    alignment: u16,
};
const MemberC = extern struct {
    name: ?[*:0]const u8,
    type: types.MemberType,
    flags: types.MemberFlags,
    bit_offset: usize,
    bit_size: usize,
    byte_size: usize,
    slot: usize,
    structure: ?Value,
};
const Action = extern struct {
    type: thunk_js.ActionType,
    fn_id: usize,
    arg_address: usize = 0,
    arg_size: usize = 0,
    futex_handle: usize = 0,
};

fn missing(comptime T: type) comptime_int {
    return std.math.maxInt(T);
}

const Result = enum(u32) {
    ok,
    failure,
};

threadlocal var module_data: ?*ModuleData = null;
threadlocal var multithread: bool = false;
var imports: Imports = undefined;

fn getModuleData() !*ModuleData {
    return module_data orelse Error.NotInMainThread;
}

pub fn captureString(memory: Memory) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.capture_string(md, &memory, &value) != .ok) {
        return Error.UnableToCreateObject;
    }
    return value;
}

pub fn captureView(memory: Memory) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.capture_view(md, &memory, &value) != .ok) {
        return Error.UnableToCreateDataView;
    }
    return value;
}

pub fn castView(memory: Memory, structure: Value) !Value {
    const md = try getModuleData();
    var value: Value = undefined;
    if (imports.cast_view(md, &memory, structure, &value) != .ok) {
        return Error.UnableToCreateObject;
    }
    return value;
}

pub fn getSlotNumber(scope: u32, key: u32) !usize {
    const md = try getModuleData();
    var result: u32 = undefined;
    if (imports.get_slot_number(md, scope, key, &result) != .ok) {
        return Error.UnableToObtainSlot;
    }
    return result;
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
        .type = def.type,
        .flags = def.flags,
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
        .type = member.type,
        .flags = member.flags,
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

pub fn writeToConsole(dv: Value) !void {
    const md = try getModuleData();
    if (imports.write_to_console(md, dv) != .ok) {
        return Error.UnableToWriteToConsole;
    }
}

pub fn writeBytesToConsole(bytes: [*]const u8, len: usize) !void {
    const memory: Memory = .{
        .bytes = @constCast(bytes),
        .len = len,
        .attributes = .{ .is_comptime = true },
    };
    const dv = try captureView(memory);
    try writeToConsole(dv);
}

pub fn handleJsCall(ptr: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize, wait: bool) thunk_js.ActionResult {
    var action: Action = .{
        .type = .call,
        .fn_id = fn_id,
        .arg_address = @intFromPtr(arg_ptr),
        .arg_size = arg_size,
    };
    const md: *ModuleData = @ptrCast(ptr);
    if (module_data == md) {
        return imports.perform_js_action(md, &action);
    } else {
        const initial_value = 0xffff_ffff;
        var futex: Futex = undefined;
        if (wait) {
            futex.value = std.atomic.Value(u32).init(initial_value);
            futex.handle = @intFromPtr(&futex);
            action.futex_handle = futex.handle;
        }
        var result = imports.queue_js_action(md, &action);
        if (result == .ok and wait) {
            std.Thread.Futex.wait(&futex.value, initial_value);
            result = @enumFromInt(futex.value.load(.acquire));
        }
        return result;
    }
}

pub fn releaseFunction(fn_ptr: anytype) !void {
    const FT = types.FnPointerTarget(@TypeOf(fn_ptr));
    const thunk_address = @intFromPtr(fn_ptr);
    const ptr = try thunk_js.getPointer(FT, fn_ptr);
    const md: *ModuleData = @ptrCast(ptr);
    const control = thunk_js.createThunkController(@This(), FT);
    const fn_id = try control(md, .destroy, thunk_address);
    var action: Action = .{ .type = .release, .fn_id = fn_id };
    if (module_data == md) {
        if (imports.perform_js_action(md, &action) != .ok) {
            return Error.Unknown;
        }
    } else {
        if (imports.queue_js_action(md, &action) != .ok) {
            return Error.MultithreadingNotEnabled;
        }
    }
}

pub fn setMultithread(state: bool) !void {
    const md = try getModuleData();
    if (multithread != state) {
        const result = switch (state) {
            true => imports.enable_multithread(md),
            false => imports.disable_multithread(md),
        };
        if (result != .ok) {
            return Error.UnableToUseThread;
        }
        multithread = state;
    }
}

fn initialize(md: *ModuleData) callconv(.C) Result {
    module_data = md;
    return .ok;
}

// allocator for fixed memory
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

fn clearBytes(bytes: [*]u8, len: usize) void {
    var start: usize = 0;
    inline for (.{ usize, u8 }) |T| {
        const mask = ~(@as(usize, @sizeOf(T)) - 1);
        const remaining = len - start;
        const count = remaining & mask;
        if (count > 0) {
            const end = start + count;
            for (std.mem.bytesAsSlice(T, bytes[start..end])) |*ptr| ptr.* = 0;
            start += count;
            if (start == len) break;
        }
    }
}

test "clearBytes" {
    const lengths = [_]usize{ 18, 19, 20, 21, 23, 333 };
    for (lengths) |len| {
        const ptr_align = 0;
        const bytes = allocator.rawAlloc(len, ptr_align, 0) orelse @panic("No memory");
        clearBytes(bytes, len);
        for (bytes[0..len]) |byte| {
            try expect(byte == 0);
        }
        allocator.rawFree(bytes[0..len], ptr_align, 0);
    }
}

fn allocateExternMemory(_: MemoryType, len: usize, alignment: u8, memory: *Memory) callconv(.C) Result {
    const ptr_align = if (alignment != 0) std.math.log2_int(u16, alignment) else 0;
    const bytes = allocator.rawAlloc(len, ptr_align, 0) orelse return .failure;
    clearBytes(bytes, len);
    memory.bytes = bytes;
    memory.len = len;
    memory.attributes.alignment = alignment;
    memory.attributes.is_const = false;
    memory.attributes.is_comptime = false;
    return .ok;
}

fn freeExternMemory(_: MemoryType, memory: *const Memory) callconv(.C) Result {
    const bytes = memory.bytes orelse return .failure;
    const alignment = memory.attributes.alignment;
    const len = memory.len;
    const ptr_align = if (alignment != 0) std.math.log2_int(u16, alignment) else 0;
    allocator.rawFree(bytes[0..len], ptr_align, 0);
    return .ok;
}

fn overrideWrite(bytes: [*]const u8, len: usize) callconv(.C) Result {
    writeBytesToConsole(bytes, len) catch return .failure;
    return .ok;
}

fn runThunk(
    thunk_address: usize,
    fn_address: usize,
    args: *anyopaque,
) callconv(.C) Result {
    const thunk: thunk_zig.Thunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    return if (thunk(fn_ptr, args)) .ok else |_| .failure;
}

fn runVariadicThunk(
    thunk_address: usize,
    fn_address: usize,
    args: *anyopaque,
    attr_ptr: *const anyopaque,
    arg_count: usize,
) callconv(.C) Result {
    const thunk: thunk_zig.VariadicThunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    return if (thunk(fn_ptr, args, attr_ptr, arg_count)) .ok else |_| .failure;
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

const Futex = struct {
    value: std.atomic.Value(u32),
    handle: usize = undefined,
};

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
    capture_view: *const fn (*ModuleData, *const Memory, *Value) callconv(.C) Result,
    cast_view: *const fn (*ModuleData, *const Memory, Value, *Value) callconv(.C) Result,
    read_slot: *const fn (*ModuleData, ?Value, usize, *Value) callconv(.C) Result,
    write_slot: *const fn (*ModuleData, ?Value, usize, ?Value) callconv(.C) Result,
    begin_structure: *const fn (*ModuleData, *const StructureC, *Value) callconv(.C) Result,
    attach_member: *const fn (*ModuleData, Value, *const MemberC, bool) callconv(.C) Result,
    attach_template: *const fn (*ModuleData, Value, Value, bool) callconv(.C) Result,
    define_structure: *const fn (*ModuleData, Value, *Value) callconv(.C) Result,
    end_structure: *const fn (*ModuleData, Value) callconv(.C) Result,
    create_template: *const fn (*ModuleData, ?Value, *Value) callconv(.C) Result,
    write_to_console: *const fn (*ModuleData, Value) callconv(.C) Result,
    enable_multithread: *const fn (*ModuleData) callconv(.C) thunk_js.ActionResult,
    disable_multithread: *const fn (*ModuleData) callconv(.C) thunk_js.ActionResult,
    perform_js_action: *const fn (*ModuleData, *Action) callconv(.C) thunk_js.ActionResult,
    queue_js_action: *const fn (*ModuleData, *Action) callconv(.C) thunk_js.ActionResult,
};

// pointer table that's used on the C side
const Exports = extern struct {
    initialize: *const fn (*ModuleData) callconv(.C) Result,
    allocate_fixed_memory: *const fn (MemoryType, usize, u8, *Memory) callconv(.C) Result,
    free_fixed_memory: *const fn (MemoryType, *const Memory) callconv(.C) Result,
    get_factory_thunk: *const fn (*usize) callconv(.C) Result,
    run_thunk: *const fn (usize, usize, *anyopaque) callconv(.C) Result,
    run_variadic_thunk: *const fn (usize, usize, *anyopaque, *const anyopaque, usize) callconv(.C) Result,
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

fn createGetFactoryThunk(comptime T: type) fn (*usize) callconv(.C) Result {
    const host = @This();
    const ns = struct {
        fn getFactoryThunk(dest: *usize) callconv(.C) Result {
            const factory = exporter.createRootFactory(host, T);
            dest.* = @intFromPtr(factory);
            return .ok;
        }
    };
    return ns.getFactoryThunk;
}

pub fn createModule(comptime T: type) Module {
    return .{
        .version = 5,
        .attributes = exporter.getModuleAttributes(),
        .imports = &imports,
        .exports = &.{
            .initialize = initialize,
            .allocate_fixed_memory = allocateExternMemory,
            .free_fixed_memory = freeExternMemory,
            .get_factory_thunk = createGetFactoryThunk(T),
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
    try expect(module.version == 4);
    try expect(module.attributes.little_endian == (builtin.target.cpu.arch.endian() == .little));
}
