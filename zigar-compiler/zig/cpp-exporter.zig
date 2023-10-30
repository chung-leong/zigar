const std = @import("std");
const exporter = @import("exporter.zig");
const builtin = @import("builtin");
const assert = std.debug.assert;

const Value = exporter.Value;
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

pub const Result = enum(u32) {
    OK,
    Failure,
};

// host interface
pub const Host = struct {
    context: Call,

    pub const RuntimeHost = Host;

    var initial_context: ?Call = null;
    var flush_required: bool = false;

    pub fn init(ptr: *anyopaque) Host {
        const context: Call = @ptrCast(ptr);
        if (initial_context == null) {
            initial_context = context;
        }
        return .{ .context = context };
    }

    pub fn done(self: Host) void {
        if (initial_context == self.context) {
            initial_context = null;
            if (flush_required) {
                _ = callbacks.flush_console(self.context);
                flush_required = false;
            }
        }
    }

    pub fn allocateMemory(self: Host, size: usize, ptr_align: u8) !Memory {
        var memory: Memory = undefined;
        if (callbacks.allocate_memory(self.context, size, ptr_align, &memory) != .OK) {
            return Error.UnableToAllocateMemory;
        }
        return memory;
    }

    pub fn freeMemory(self: Host, memory: Memory, ptr_align: u8) !void {
        if (callbacks.free_memory(self.context, &memory, ptr_align) != .OK) {
            return Error.UnableToFreeMemory;
        }
    }

    pub fn createString(self: Host, memory: Memory) !Value {
        var value: Value = undefined;
        if (callbacks.create_string(self.context, &memory, &value) != .OK) {
            return Error.UnableToCreateObject;
        }
        return value;
    }

    pub fn createObject(self: Host, structure: Value, arg: Value) !Value {
        var value: Value = undefined;
        if (callbacks.create_object(self.context, structure, arg, &value) != .OK) {
            return Error.UnableToCreateObject;
        }
        return value;
    }

    pub fn createView(self: Host, memory: Memory) !Value {
        var value: Value = undefined;
        if (callbacks.create_view(self.context, &memory, &value) != .OK) {
            return Error.UnableToCreateDataView;
        }
        return value;
    }

    pub fn castView(self: Host, structure: Value, dv: Value) !Value {
        var value: Value = undefined;
        if (callbacks.cast_view(self.context, structure, dv, &value) != .OK) {
            return Error.UnableToCreateObject;
        }
        return value;
    }

    pub fn readSlot(self: Host, target: ?Value, id: usize) !Value {
        var result: Value = undefined;
        if (callbacks.read_slot(self.context, target, id, &result) != .OK) {
            return Error.UnableToRetrieveObject;
        }
        return result;
    }

    pub fn writeSlot(self: Host, target: ?Value, id: usize, value: ?Value) !void {
        if (callbacks.write_slot(self.context, target, id, value) != .OK) {
            return Error.UnableToInsertObject;
        }
    }

    pub fn beginStructure(self: Host, def: Structure) !Value {
        var structure: Value = undefined;
        if (callbacks.begin_structure(self.context, &def, &structure) != .OK) {
            return Error.UnableToStartStructureDefinition;
        }
        return structure;
    }

    pub fn attachMember(self: Host, structure: Value, member: Member, is_static: bool) !void {
        if (callbacks.attach_member(self.context, structure, &member, is_static) != .OK) {
            if (is_static) {
                return Error.UnableToAddStaticMember;
            } else {
                return Error.UnableToAddStructureMember;
            }
        }
    }

    pub fn attachMethod(self: Host, structure: Value, method: Method, is_static_only: bool) !void {
        if (callbacks.attach_method(self.context, structure, &method, is_static_only) != .OK) {
            return Error.UnableToAddMethod;
        }
    }

    pub fn attachTemplate(self: Host, structure: Value, template: Value, is_static: bool) !void {
        if (callbacks.attach_template(self.context, structure, template, is_static) != .OK) {
            return Error.UnableToAddStructureTemplate;
        }
    }

    pub fn finalizeStructure(self: Host, structure: Value) !void {
        if (callbacks.finalize_structure(self.context, structure) != .OK) {
            return Error.UnableToDefineStructure;
        }
    }

    pub fn createTemplate(self: Host, dv: ?Value) !Value {
        var value: Value = undefined;
        if (callbacks.create_template(self.context, dv, &value) != .OK) {
            return Error.UnableToCreateStructureTemplate;
        }
        return value;
    }

    pub fn writeToConsole(ptr: [*]const u8, len: usize) bool {
        if (initial_context) |context| {
            const memory: Memory = .{
                .bytes = @constCast(ptr),
                .len = len,
            };
            _ = callbacks.write_to_console(context, &memory);
            flush_required = true;
            return true;
        } else {
            return false;
        }
    }
};

// pointer table that's filled on the C++ side
const Callbacks = extern struct {
    allocate_memory: *const fn (Call, usize, u8, *Memory) callconv(.C) Result,
    free_memory: *const fn (Call, *const Memory, u8) callconv(.C) Result,
    create_string: *const fn (Call, *const Memory, *Value) Result,
    create_object: *const fn (Call, Value, Value, *Value) Result,
    create_view: *const fn (Call, *const Memory, *Value) Result,
    cast_view: *const fn (Call, Value, Value, *Value) Result,
    read_slot: *const fn (Call, ?Value, usize, *Value) callconv(.C) Result,
    write_slot: *const fn (Call, ?Value, usize, ?Value) callconv(.C) Result,
    begin_structure: *const fn (Call, *const Structure, *Value) callconv(.C) Result,
    attach_member: *const fn (Call, Value, *const Member, bool) callconv(.C) Result,
    attach_method: *const fn (Call, Value, *const Method, bool) callconv(.C) Result,
    attach_template: *const fn (Call, Value, Value, bool) callconv(.C) Result,
    finalize_structure: *const fn (Call, Value) callconv(.C) Result,
    create_template: *const fn (Call, ?Value, *Value) callconv(.C) Result,
    write_to_console: *const fn (Call, *const Memory) callconv(.C) Result,
    flush_console: *const fn (Call) callconv(.C) Result,
};

var callbacks: Callbacks = undefined;

const ModuleAttributes = packed struct(u32) {
    little_endian: bool,
    runtime_safety: bool,
    _: u30 = 0,
};

pub const Module = extern struct {
    version: u32 = 1,
    attributes: ModuleAttributes,
    callbacks: *Callbacks = &callbacks,
    factory: Thunk,
};

pub fn createModule(comptime T: type) Module {
    return .{
        .attributes = .{
            .little_endian = builtin.target.cpu.arch.endian() == .Little,
            .runtime_safety = switch (builtin.mode) {
                .Debug, .ReleaseSafe => true,
                else => false,
            },
        },
        .factory = exporter.createRootFactory(Host, T),
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
    assert(module.version == 1);
    assert(module.attributes.little_endian == (builtin.target.cpu.arch.endian() == .Little));
    switch (@typeInfo(@TypeOf(module.factory))) {
        .Pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .Fn => |f| {
                    assert(f.params.len == 2);
                    assert(f.calling_convention == .C);
                },
                else => {
                    assert(false);
                },
            }
        },
        else => {
            assert(false);
        },
    }
}

pub fn getOS() type {
    return struct {
        pub const system = ns: {
            // create a proxy of the system namespace so that we can intercept
            // calls to write() and redirect them to the console.log() on the
            // Javascript side; as we currently cannot reify a struct with decls
            // using @Type, we're relying on source code generated by a script
            const proxy = if (builtin.link_libc) @import("./os/c.zig") else switch (builtin.os.tag) {
                .ios, .macos, .watchos, .tvos => @import("./os/darwin.zig"),
                .dragonfly => @import("./os/dragonfly.zig"),
                .freebsd => @import("./os/freebsd.zig"),
                .haiku => @import("./os/haiku.zig"),
                .linux => @import("./os/linux.zig"),
                .netbsd => @import("./os/netbsd.zig"),
                .openbsd => @import("./os/openbsd.zig"),
                .solaris => @import("./os/solaris.zig"),
                else => @import("./os/c.zig"),
            };
            const target = proxy.target;
            const fd_t = target.fd_t;
            const STDOUT_FILENO = target.STDOUT_FILENO;
            const STDERR_FILENO = target.STDERR_FILENO;
            const return_t = @typeInfo(@TypeOf(target.write)).Fn.return_type orelse usize;
            const substitutes = struct {
                pub fn write(f: fd_t, ptr: [*]const u8, len: usize) return_t {
                    if (f == STDOUT_FILENO or f == STDERR_FILENO) {
                        if (Host.writeToConsole(ptr, len)) {
                            return @intCast(len);
                        }
                    }
                    return target.write(f, ptr, len);
                }
            };
            break :ns proxy.with(substitutes);
        };
    };
}
