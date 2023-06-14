const std = @import("std");
const t = @import("type");
const e = @import("error");

const Result = t.Result;
const StructureType = t.StructureType;
const MemberType = t.MemberType;
const Value = t.Value;
const Thunk = t.Thunk;
const Member = t.Member;
const MemberSet = t.MemberSet;
const Method = t.Method;
const MethodSet = t.MethodSet;
const Memory = t.Memory;
const ModuleFlags = t.ModuleFlags;
const Module = t.Module;
const Error = e.Error;

//-----------------------------------------------------------------------------
//  Value-pointer table that's filled on the C++ side
//-----------------------------------------------------------------------------
const Callbacks = extern struct {
    allocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    reallocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    free_memory: *const fn (host: Host, dest: *[*]u8) callconv(.C) Result,
    get_memory: *const fn (host: Host, value: Value, dest: *Memory) callconv(.C) Result,
    get_relocatable: *const fn (host: Host, value: Value, id: u32, dest: *Value) callconv(.C) Result,

    read_slot: *const fn (host: Host, id: u32, dest: *Value) callconv(.C) Result,
    write_slot: *const fn (host: Host, id: u32, value: Value) callconv(.C) Result,

    create_structure: *const fn (host: Host, s_type: StructureType, name: [*:0]const u8, dest: *Value) callconv(.C) Result,
    shape_structure: *const fn (host: Host, structure: Value, def: *const MemberSet) callconv(.C) Result,
    attach_variables: *const fn (host: Host, structure: Value, def: *const MemberSet) callconv(.C) Result,
    attach_methods: *const fn (host: Host, structure: Value, def: *const MethodSet) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

pub const Host = *opaque {
    fn getPointer(self: Host, value: Value, comptime PT: type) !PT {
        var memory: Memory = undefined;
        if (callbacks.get_memory(self, value, &memory) != .OK) {
            return Error.Unknown;
        }
        return @ptrCast(PT, memory.bytes);
    }

    fn getRelocatable(self: Host, value: Value, id: u32) Value {
        var result: Value = undefined;
        if (callbacks.get_relocatable(self, value, id, &result) != .OK) {
            return Error.Unknown;
        }
        return result;
    }

    fn readSlot(self: Host, slot: u32) !Value {
        var value: Value = undefined;
        if (callbacks.read_slot(self, slot, &value) != .OK) {
            return Error.Unknown;
        }
        return value;
    }

    fn writeSlot(self: Host, slot: u32, value: Value) !void {
        if (callbacks.write_slot(self, slot, value) != .OK) {
            return Error.Unknown;
        }
    }

    fn createStructure(self: Host, s_type: StructureType, name: []const u8) !Value {
        var def: Value = undefined;
        if (callbacks.create_structure(self, s_type, @ptrCast([*:0]const u8, name), &def) != .OK) {
            return Error.Unknown;
        }
        return def;
    }

    fn shapeStructure(self: Host, structure: Value, def: MemberSet) !void {
        if (callbacks.shape_structure(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachVariables(self: Host, structure: Value, def: MemberSet) !void {
        if (callbacks.attach_variables(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachMethods(self: Host, structure: Value, def: MethodSet) !void {
        if (callbacks.attach_methods(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }
};
