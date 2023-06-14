const std = @import("std");
const slot = @import("slot");
const t = @import("type");
const e = @import("error");

const Result = t.Result;
const StructureType = t.StructureType;
const MemberType = t.MemberType;
const Value = t.Value;
const Thunk = t.Thunk;
const Member = t.Member;
const Method = t.Method;
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

    get_slot: *const fn (host: Host, id: u32, dest: *Value) callconv(.C) Result,
    set_slot: *const fn (host: Host, id: u32, value: Value) callconv(.C) Result,

    create_structure: *const fn (host: Host, s_type: StructureType, name: [*:0]const u8, dest: *Value) callconv(.C) Result,
    shape_structure: *const fn (host: Host, structure: Value, members: [*]const Member, count: usize, size: usize) callconv(.C) Result,
    attach_variables: *const fn (host: Host, structure: Value, members: [*]const Member, count: usize) callconv(.C) Result,
    attach_methods: *const fn (host: Host, structure: Value, methods: [*]const Method, count: usize) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

pub const Host = *opaque {
    // allocate slots for classe, function, and other language constructs on the host side
    const type_slot = slot.allocator.get(.{});

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
            return Error.Unknown;
        }
        return value;
    }

    fn setSlot(self: Host, id: u32, value: Value) !void {
        if (callbacks.set_slot(self, id, value) != .OK) {
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

    fn shapeStructure(self: Host, structure: Value, members: []const Member, size: usize) !void {
        if (callbacks.attach_member(self, structure, @ptrCast([*]const Member, members), members.len, size) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachVariables(self: Host, structure: Value, members: []const Member) !void {
        if (callbacks.attach_variables(self, structure, @ptrCast([*]const Member, members), members.len) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachMethods(self: Host, structure: Value, methods: []const Method) !void {
        if (callbacks.attach_methods(self, structure, @ptrCast([*]const Method, methods), methods.len) != .OK) {
            return Error.Unknown;
        }
    }
};
