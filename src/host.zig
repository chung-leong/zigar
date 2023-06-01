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
};

pub const Value = *opaque {};

//-----------------------------------------------------------------------------
//  Value-pointer table that's filled on the C++ side
//-----------------------------------------------------------------------------
const Callbacks = extern struct {
    allocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    reallocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    free_memory: *const fn (host: Host, dest: *[*]u8) callconv(.C) Result,

    get_slot: *const fn (host: Host, slot_id: usize, dest: *Value) callconv(.C) Result,
    set_slot: *const fn (host: Host, slot_id: usize, object: Value) callconv(.C) Result,

    begin_structure: *const fn (host: Host, s_type: StructureType, dest: *Value) callconv(.C) Result,
    add_member: *const fn (host: Host, def: Value, member: Member) callconv(.C) Result,
    finalize_structure: *const fn (host: Host, def: Value, dest: *Value) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

pub const Host = *opaque {
    // allocate slots for classe, function, and other language constructs on the host side
    const type_slot = slot.allocator.get(.{ .type = "host_type" });

    fn getConstruct(self: Host, comptime S: anytype) Value {
        const slot_id = type_slot.get(S);
        var construct: Value = undefined;
        if (callbacks.get_slot(self, slot_id, &construct) != .OK) {
            return null;
        }
        return construct;
    }

    fn setConstruct(self: Host, comptime S: anytype, construct: Value) !void {
        const slot_id = type_slot.get(S);
        if (callbacks.set_slot(self, slot_id, construct) != .OK) {
            return Error.UnknownError;
        }
    }

    fn beginStructure(self: Host, s_type: StructureType) !Value {
        var value: Value = undefined;
        if (callbacks.begin_structure(self, s_type, &value) != .OK) {
            return Error.UnknownError;
        }
        return value;
    }

    fn addMember(self: Host, def: Value, member: Member) !void {
        if (callbacks.add_member(self, def, member) != .OK) {
            return Error.UnknownError;
        }
    }

    fn finalizeStructure(self: Host, def: Value) Value {
        var value: Value = undefined;
        if (callbacks.finalize_structure(self, def, &value) != .OK) {
            return Error.UnknownError;
        }
        return value;
    }
};

pub const Thunk = *const fn (host: Host) callconv(.C) void;
pub const Factory = *const fn (host: Host, dest: *Value) callconv(.C) Result;
pub const Module = extern struct {
    version: c_int,
    callbacks: *Callbacks,
    factory: Factory,
};
