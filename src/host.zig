const std = @import("std");
const slot = @import("slot");

pub const Error = error{
    TODO,
    UnknownError,
};

//-----------------------------------------------------------------------------
//  Enum and structs used in Zig, C++, and JavaScript
//  (need to keep them in sync)
//-----------------------------------------------------------------------------
pub const Result = enum(u32) {
    OK,
    Failure,
};

pub const StructureType = enum(u32) {
    Normal = 0,
    Union,
    Enumeration,
    Singleton,
    Array,
    Opaque,
};

pub const MemberType = enum(u32) {
    Void = 0,
    Bool,
    Int,
    Float,
    Structure,
    Pointer,
};

pub const Member = extern struct {
    name: ?[*:0]const u8 = null,
    type: MemberType,
    bit_offset: u32,
    bits: u32,
    signed: bool = false,
    len: u32 = 0,
    class_id: u32,
};

pub const Memory = extern struct {
    bytes: [*]u8,
    len: usize,
};

pub const Value = *opaque {};

//-----------------------------------------------------------------------------
//  Value-pointer table that's filled on the C++ side
//-----------------------------------------------------------------------------
const Callbacks = extern struct {
    allocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    reallocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    free_memory: *const fn (host: Host, dest: *[*]u8) callconv(.C) Result,
    get_memory: *const fn (host: Host, value: Value, dest: *Memory) callconv(.C) Result,
    get_relocatable: *const fn (host: Host, value: Value, id: u32, dest: *Value) callconv(.C) Result,

    get_slot: *const fn (host: Host, id: u32, dest: *Value) callconv(.C) Result,
    set_slot: *const fn (host: Host, id: u32, value: Value) callconv(.C) Result,

    begin_structure: *const fn (host: Host, s_type: StructureType, dest: *Value) callconv(.C) Result,
    attach_default_data: *const fn (host: Host, def: Value, bytes: Memory) callconv(.C) Result,
    attach_default_pointer: *const fn (host: Host, def: Value, id: u32, reloc: Value) callconv(.C) Result,
    attach_member: *const fn (host: Host, def: Value, member: Member) callconv(.C) Result,
    attach_static: *const fn (host: Host, def: Value, static: Value) callconv(.C) Result,
    finalize_structure: *const fn (host: Host, def: Value) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

pub const Host = *opaque {
    // allocate slots for classe, function, and other language constructs on the host side
    const type_slot = slot.allocator.get(.{});

    fn getPointer(self: Host, value: Value, comptime PT: type) !PT {
        var memory: Memory = undefined;
        if (callbacks.get_memory(self, value, &memory) != .OK) {
            return Error.UnknownError;
        }
        return @ptrCast(PT, memory.bytes);
    }

    fn getRelocatable(self: Host, value: Value, id: u32) Value {
        var result: Value = undefined;
        if (callbacks.get_relocatable(self, value, id, &result) != .OK) {
            return Error.UnknownError;
        }
        return result;
    }

    fn getConstructId(_: Host, comptime S: anytype) u32 {
        return type_slot.get(S);
    }

    fn getRelocatableId(_: Host, comptime T: anytype, index: comptime_int) u32 {
        // per-struct slot allocator
        const relocatable_slot = slot.allocator.get(.{ .Struct = T });
        return relocatable_slot.get(.{ .Index = index });
    }

    fn getSlot(self: Host, id: u32) !Value {
        var value: Value = undefined;
        if (callbacks.get_slot(self, id, &value) != .OK) {
            return Error.UnknownError;
        }
        return value;
    }

    fn setSlot(self: Host, id: u32, value: Value) !void {
        if (callbacks.set_slot(self, id, value) != .OK) {
            return Error.UnknownError;
        }
    }

    fn beginStructure(self: Host, s_type: StructureType) !Value {
        var def: Value = undefined;
        if (callbacks.begin_structure(self, s_type, &def) != .OK) {
            return Error.UnknownError;
        }
        return def;
    }

    fn attachMember(self: Host, def: Value, member: Member) !void {
        if (callbacks.attach_member(self, def, member) != .OK) {
            return Error.UnknownError;
        }
    }

    fn attachStatic(self: Host, def: Value, static: Value) !void {
        if (callbacks.attach_static(self, def, static) != .OK) {
            return Error.UnknownError;
        }
    }

    fn finalizeStructure(self: Host, def: Value) !void {
        if (callbacks.finalize_structure(self, def) != .OK) {
            return Error.UnknownError;
        }
    }
};

pub const Thunk = *const fn (host: Host) callconv(.C) void;
pub const Factory = *const fn (host: Host, dest: *u32) callconv(.C) Result;
pub const Module = extern struct {
    version: c_int,
    callbacks: *Callbacks,
    factory: Factory,
};
