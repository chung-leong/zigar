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
const AnyValue = types.AnyValue;
pub const Promise = types.Promise;
pub const PromiseOf = types.PromiseOf;
pub const PromiseArgOf = types.PromiseArgOf;
pub const Generator = types.Generator;
pub const GeneratorOf = types.GeneratorOf;
pub const GeneratorArgOf = types.GeneratorArgOf;
pub const AbortSignal = types.AbortSignal;

const Module = interface.Module(AnyValue);

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

var gpa = std.heap.DebugAllocator(.{}).init;
const allocator = gpa.allocator();
var imports: Module.Imports = undefined;

pub fn createBool(initializer: bool) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.create_bool(initializer, &value) != .SUCCESS) {
        return error.UnableToCreateBoolean;
    }
    return value;
}

pub fn createInteger(initializer: i32, is_unsigned: bool) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.create_integer(initializer, is_unsigned, &value) != .SUCCESS) {
        return error.UnableToCreateInteger;
    }
    return value;
}

pub fn createBigInteger(initializer: i64, is_unsigned: bool) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.create_big_integer(initializer, is_unsigned, &value) != .SUCCESS) {
        return error.UnableToCreateInteger;
    }
    return value;
}

pub fn createString(initializer: []const u8) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.create_string(initializer.ptr, initializer.len, &value) != .SUCCESS) {
        return error.UnableToCreateString;
    }
    return value;
}

pub fn createView(bytes: ?[*]const u8, len: usize, copying: bool, export_handle: ?usize) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.create_view(bytes, len, copying, export_handle orelse 0, &value) != .SUCCESS) {
        return error.UnableToCreateDataView;
    }
    return value;
}

pub fn createInstance(structure: AnyValue, dv: AnyValue, slots: ?AnyValue) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.create_instance(structure, dv, slots, &value) != .SUCCESS) {
        return error.UnableToCreateStructureInstance;
    }
    return value;
}

pub fn createTemplate(dv: ?AnyValue, slots: ?AnyValue) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.create_template(dv, slots, &value) != .SUCCESS) {
        return error.UnableToCreateTemplate;
    }
    return value;
}

pub fn createList() !AnyValue {
    var list: AnyValue = undefined;
    if (imports.create_list(&list) != .SUCCESS) {
        return error.UnableToCreateList;
    }
    return list;
}

pub fn createObject() !AnyValue {
    var object: AnyValue = undefined;
    if (imports.create_object(&object) != .SUCCESS) {
        return error.UnableToCreateObject;
    }
    return object;
}

pub fn getProperty(object: AnyValue, key: []const u8) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.get_property(object, key.ptr, key.len, &value) != .SUCCESS) {
        return error.UnableToGetProperty;
    }
    return value;
}

pub fn setProperty(object: AnyValue, key: []const u8, value: AnyValue) !void {
    if (imports.set_property(object, key.ptr, key.len, value) != .SUCCESS) {
        return error.UnableToSetProperty;
    }
}

pub fn getSlotValue(object: ?AnyValue, slot: usize) !AnyValue {
    var value: AnyValue = undefined;
    if (imports.get_slot_value(object, slot, &value) != .SUCCESS) {
        return error.UnableToGetSlotValue;
    }
    return value;
}

pub fn setSlotValue(object: ?AnyValue, slot: usize, value: AnyValue) !void {
    if (imports.set_slot_value(object, slot, value) != .SUCCESS) {
        return error.UnableToSetSlotValue;
    }
}

pub fn appendList(list: AnyValue, value: AnyValue) !void {
    if (imports.append_list(list, value) != .SUCCESS) {
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
    if (imports.begin_structure(structure) != .SUCCESS) {
        return error.UnableToDefineStructure;
    }
}

pub fn finishStructure(structure: AnyValue) !void {
    if (imports.finish_structure(structure) != .SUCCESS) {
        return error.UnableToDefineStructure;
    }
}

pub fn handleJscall(fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E {
    var call: Module.Jscall = .{
        .fn_id = fn_id,
        .arg_address = @intFromPtr(arg_ptr),
        .arg_size = arg_size,
    };
    return imports.handle_jscall(&call);
}

pub fn releaseFunction(fn_ptr: anytype) void {
    const FT = types.FnPointerTarget(@TypeOf(fn_ptr));
    const thunk_address = @intFromPtr(fn_ptr);
    const control = thunk_js.createThunkController(@This(), FT);
    const fn_id = control(null, .get_id, thunk_address) catch return;
    _ = imports.release_function(fn_id);
}

pub fn startMultithread() !void {
    if (imports.enable_multithread() != .SUCCESS) return error.UnableToUseThread;
}

pub fn stopMultithread() void {
    _ = imports.disable_multithread();
}

pub fn getInstance() !*anyopaque {
    var ptr: *anyopaque = undefined;
    if (imports.get_instance(&ptr) != .SUCCESS) {
        return error.UnableToGetHostInstance;
    }
    return ptr;
}

pub fn initializeThread(ptr: *anyopaque) !void {
    if (imports.initialize_thread(ptr) != .SUCCESS) {
        return error.UnableToInitializeThread;
    }
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
    const thunk_address = controller(.create, fn_id) catch return .FAULT;
    dest.* = thunk_address;
    return .SUCCESS;
}

fn destroyJsThunk(
    controller_address: usize,
    fn_address: usize,
    dest: *usize,
) callconv(.C) E {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    const fn_id = controller(.destroy, fn_address) catch return .FAULT;
    dest.* = fn_id;
    return .SUCCESS;
}

const hook_table = hooks.getHookTable(@This());

fn getSyscallHook(name: [*:0]const u8, dest: *hooks.Entry) callconv(.C) E {
    const name_s = name[0..std.mem.len(name)];
    const entry = hook_table.get(name_s) orelse return .NOENT;
    dest.* = entry;
    return .SUCCESS;
}

pub fn redirectSyscall(call: *hooks.Syscall) std.posix.E {
    const result = imports.handle_syscall(call);
    // translate from WASI enum to the current system's
    return inline for (std.meta.fields(E)) |field| {
        const wasi_enum = @field(E, field.name);
        if (wasi_enum == result) {
            break switch (@hasField(std.posix.E, field.name)) {
                true => @field(std.posix.E, field.name),
                false => .FAULT,
            };
        }
    } else .FAULT;
}

pub fn isRedirecting(comptime literal: @TypeOf(.enum_literal)) bool {
    var mask: hooks.Mask = undefined;
    if (imports.get_syscall_mask(&mask) != .SUCCESS) return false;
    const name = @tagName(literal);
    return @field(mask, name);
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
            .get_export_address = getExportAddress,
            .get_factory_thunk = ns.getFactoryThunk,
            .run_thunk = runThunk,
            .run_variadic_thunk = runVariadicThunk,
            .create_js_thunk = createJsThunk,
            .destroy_js_thunk = destroyJsThunk,
            .get_syscall_hook = getSyscallHook,
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
