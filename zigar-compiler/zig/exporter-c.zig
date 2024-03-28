const std = @import("std");
const exporter = @import("exporter.zig");
const builtin = @import("builtin");
const assert = std.debug.assert;

const Value = exporter.Value;
const HostOptions = exporter.HostOptions;
const StructureType = exporter.StructureType;
const Structure = exporter.Structure;
const MemberType = exporter.MemberType;
const Member = exporter.Member;
const Method = exporter.Method;
const Memory = exporter.Memory;
const Thunk = exporter.Thunk;
const Error = exporter.Error;
const missing = exporter.missing;
const Call = *anyopaque;

// support both 0.11 and 0.12
const Little = if (@hasField(std.builtin.Endian, "Little")) .Little else .little;

pub const Result = enum(u32) {
    OK,
    Failure,
};

threadlocal var initial_context: ?Call = null;

// host interface
pub const Host = struct {
    context: Call,
    options: HostOptions,

    pub fn init(call_ptr: *anyopaque, arg_ptr: ?*anyopaque) Host {
        const context: Call = @ptrCast(@alignCast(call_ptr));
        const options_ptr: ?*HostOptions = @ptrCast(@alignCast(arg_ptr));
        if (initial_context == null) {
            initial_context = context;
        }
        return .{ .context = context, .options = if (options_ptr) |ptr| ptr.* else .{} };
    }

    pub fn release(self: Host) void {
        if (initial_context == self.context) {
            initial_context = null;
        }
    }

    pub fn allocateMemory(self: Host, size: usize, alignment: u16) !Memory {
        var memory: Memory = undefined;
        if (imports.allocate_host_memory(self.context, size, alignment, &memory) != .OK) {
            return Error.UnableToAllocateMemory;
        }
        return memory;
    }

    pub fn freeMemory(self: Host, memory: Memory) !void {
        if (imports.free_host_memory(self.context, &memory) != .OK) {
            return Error.UnableToFreeMemory;
        }
    }

    pub fn captureString(self: Host, memory: Memory) !Value {
        var value: Value = undefined;
        if (imports.capture_string(self.context, &memory, &value) != .OK) {
            return Error.UnableToCreateObject;
        }
        return value;
    }

    pub fn captureView(self: Host, memory: Memory) !Value {
        var value: Value = undefined;
        if (imports.capture_view(self.context, &memory, &value) != .OK) {
            return Error.UnableToCreateDataView;
        }
        return value;
    }

    pub fn castView(self: Host, structure: Value, dv: Value, writable: bool) !Value {
        var value: Value = undefined;
        if (imports.cast_view(self.context, structure, dv, writable, &value) != .OK) {
            return Error.UnableToCreateObject;
        }
        return value;
    }

    pub fn getSlotNumber(self: Host, scope: u32, key: u32) !usize {
        var result: u32 = undefined;
        if (imports.get_slot_number(self.context, scope, key, &result) != .OK) {
            return Error.UnableToObtainSlot;
        }
        return result;
    }

    pub fn readSlot(self: Host, target: ?Value, id: usize) !Value {
        var result: Value = undefined;
        if (imports.read_slot(self.context, target, id, &result) != .OK) {
            return Error.UnableToRetrieveObject;
        }
        return result;
    }

    pub fn writeSlot(self: Host, target: ?Value, id: usize, value: ?Value) !void {
        if (imports.write_slot(self.context, target, id, value) != .OK) {
            return Error.UnableToInsertObject;
        }
    }

    pub fn beginStructure(self: Host, def: Structure) !Value {
        var structure: Value = undefined;
        if (imports.begin_structure(self.context, &def, &structure) != .OK) {
            return Error.UnableToStartStructureDefinition;
        }
        return structure;
    }

    pub fn attachMember(self: Host, structure: Value, member: Member, is_static: bool) !void {
        if (imports.attach_member(self.context, structure, &member, is_static) != .OK) {
            if (is_static) {
                return Error.UnableToAddStaticMember;
            } else {
                return Error.UnableToAddStructureMember;
            }
        }
    }

    pub fn attachMethod(self: Host, structure: Value, method: Method, is_static_only: bool) !void {
        if (imports.attach_method(self.context, structure, &method, is_static_only) != .OK) {
            return Error.UnableToAddMethod;
        }
    }

    pub fn attachTemplate(self: Host, structure: Value, template: Value, is_static: bool) !void {
        if (imports.attach_template(self.context, structure, template, is_static) != .OK) {
            return Error.UnableToAddStructureTemplate;
        }
    }

    pub fn finalizeShape(self: Host, structure: Value) !void {
        if (imports.finalize_shape(self.context, structure) != .OK) {
            return Error.UnableToDefineStructure;
        }
    }

    pub fn endStructure(self: Host, structure: Value) !void {
        if (imports.end_structure(self.context, structure) != .OK) {
            return Error.UnableToDefineStructure;
        }
    }

    pub fn createTemplate(self: Host, dv: ?Value) !Value {
        var value: Value = undefined;
        if (imports.create_template(self.context, dv, &value) != .OK) {
            return Error.UnableToCreateStructureTemplate;
        }
        return value;
    }

    pub fn writeToConsole(self: Host, dv: Value) !void {
        if (imports.write_to_console(self.context, dv) != .OK) {
            return Error.UnableToWriteToConsole;
        }
    }

    pub fn writeBytesToConsole(self: Host, bytes: [*]const u8, len: usize) !void {
        const memory: Memory = .{
            .bytes = @constCast(bytes),
            .len = len,
            .attributes = .{ .is_comptime = true },
        };
        const dv = try self.captureView(memory);
        try self.writeToConsole(dv);
    }
};

// allocator for fixed memory
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

fn clearBytes(bytes: [*]u8, len: usize, ptr_align: u8) void {
    switch (ptr_align) {
        0 => {
            for (bytes[0..len]) |*ptr| ptr.* = 0;
        },
        1 => {
            for (std.mem.bytesAsSlice(u16, bytes[0..len])) |*ptr| ptr.* = 0;
        },
        2 => {
            for (std.mem.bytesAsSlice(u32, bytes[0..len])) |*ptr| ptr.* = 0;
        },
        else => {
            for (std.mem.bytesAsSlice(u64, bytes[0..len])) |*ptr| ptr.* = 0;
        },
    }
}

test "clearBytes" {
    const len: usize = 64;
    var ptr_align: u8 = 0;
    while (ptr_align <= 4) : (ptr_align += 1) {
        if (allocator.rawAlloc(len, ptr_align, 0)) |bytes| {
            clearBytes(bytes, len, ptr_align);
            for (bytes[0..len]) |byte| {
                assert(byte == 0);
            }
            allocator.rawFree(bytes[0..len], ptr_align, 0);
        }
    }
}

fn allocateExternMemory(len: usize, alignment: u8, memory: *Memory) callconv(.C) Result {
    const ptr_align = if (alignment != 0) std.math.log2_int(u16, alignment) else 0;
    if (allocator.rawAlloc(len, ptr_align, 0)) |bytes| {
        clearBytes(bytes, len, ptr_align);
        memory.bytes = bytes;
        memory.len = len;
        memory.attributes.alignment = alignment;
        memory.attributes.is_const = false;
        memory.attributes.is_comptime = false;
        return .OK;
    } else {
        return .Failure;
    }
}

fn freeExternMemory(memory: *const Memory) callconv(.C) Result {
    if (memory.bytes) |bytes| {
        const alignment = memory.attributes.alignment;
        const len = memory.len;
        const ptr_align = if (alignment != 0) std.math.log2_int(u16, alignment) else 0;
        allocator.rawFree(bytes[0..len], ptr_align, 0);
        return .OK;
    } else {
        return .Failure;
    }
}

pub fn overrideWrite(bytes: [*]const u8, len: usize) callconv(.C) Result {
    if (initial_context) |context| {
        const host = Host.init(context, null);
        if (host.writeBytesToConsole(bytes, len)) {
            return .OK;
        } else |_| {}
    }
    return .Failure;
}

pub fn runThunk(call: Call, thunk_address: usize, args: *anyopaque, dest: *?Value) callconv(.C) Result {
    const thunk: Thunk = @ptrFromInt(thunk_address);
    if (thunk(@ptrCast(call), args)) |result| {
        dest.* = result;
    } else {
        dest.* = null;
    }
    return .OK;
}

// pointer table that's filled on the C side
const Imports = extern struct {
    allocate_host_memory: *const fn (Call, usize, u16, *Memory) callconv(.C) Result,
    free_host_memory: *const fn (Call, *const Memory) callconv(.C) Result,
    capture_string: *const fn (Call, *const Memory, *Value) callconv(.C) Result,
    capture_view: *const fn (Call, *const Memory, *Value) callconv(.C) Result,
    cast_view: *const fn (Call, Value, Value, bool, *Value) callconv(.C) Result,
    get_slot_number: *const fn (Call, u32, u32, *u32) callconv(.C) Result,
    read_slot: *const fn (Call, ?Value, usize, *Value) callconv(.C) Result,
    write_slot: *const fn (Call, ?Value, usize, ?Value) callconv(.C) Result,
    begin_structure: *const fn (Call, *const Structure, *Value) callconv(.C) Result,
    attach_member: *const fn (Call, Value, *const Member, bool) callconv(.C) Result,
    attach_method: *const fn (Call, Value, *const Method, bool) callconv(.C) Result,
    attach_template: *const fn (Call, Value, Value, bool) callconv(.C) Result,
    finalize_shape: *const fn (Call, Value) callconv(.C) Result,
    end_structure: *const fn (Call, Value) callconv(.C) Result,
    create_template: *const fn (Call, ?Value, *Value) callconv(.C) Result,
    write_to_console: *const fn (Call, Value) callconv(.C) Result,
};
var imports: Imports = undefined;

// pointer table that's used on the C side
const Exports = extern struct {
    allocate_fixed_memory: *const fn (usize, u8, *Memory) callconv(.C) Result,
    free_fixed_memory: *const fn (*const Memory) callconv(.C) Result,
    get_factory_thunk: *const fn (*usize) callconv(.C) Result,
    run_thunk: *const fn (Call, usize, *anyopaque, *?Value) callconv(.C) Result,
    override_write: *const fn ([*]const u8, usize) callconv(.C) Result,
};

const ModuleAttributes = packed struct(u32) {
    little_endian: bool,
    runtime_safety: bool,
    _: u30 = 0,
};

pub const Module = extern struct {
    version: u32,
    attributes: ModuleAttributes,
    imports: *Imports = &imports,
    exports: *const Exports,
};

pub fn createGetFactoryThunk(comptime T: type) fn (*usize) callconv(.C) Result {
    const ns = struct {
        fn getFactoryThunk(dest: *usize) callconv(.C) Result {
            const factory = exporter.createRootFactory(Host, T);
            dest.* = @intFromPtr(factory);
            return .OK;
        }
    };
    return ns.getFactoryThunk;
}

pub fn createModule(comptime T: type) Module {
    return .{
        .version = 2,
        .attributes = .{
            .little_endian = builtin.target.cpu.arch.endian() == Little,
            .runtime_safety = switch (builtin.mode) {
                .Debug, .ReleaseSafe => true,
                else => false,
            },
        },
        .imports = &imports,
        .exports = &.{
            .allocate_fixed_memory = allocateExternMemory,
            .free_fixed_memory = freeExternMemory,
            .get_factory_thunk = createGetFactoryThunk(T),
            .run_thunk = runThunk,
            .override_write = overrideWrite,
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
        pub const f = enum { Dog, Cat, Chicken };
        pub const g = enum(c_int) { Dog = -100, Cat, Chicken };
        pub fn h(arg1: i32, arg2: i32) bool {
            return arg1 < arg2;
        }
    };
    const module = createModule(Test);
    assert(module.version == 2);
    assert(module.attributes.little_endian == (builtin.target.cpu.arch.endian() == .little));
}
