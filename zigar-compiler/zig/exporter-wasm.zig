const std = @import("std");
const builtin = @import("builtin");
const exporter = @import("exporter.zig");

pub const Value = exporter.Value;
pub const Thunk = exporter.Thunk;
pub const Call = *const CallContext;

const StructureType = exporter.StructureType;
const Structure = exporter.Structure;
const MemberType = exporter.MemberType;
const Member = exporter.Member;
const Method = exporter.Method;
const Memory = exporter.Memory;
const MemoryDisposition = exporter.MemoryDisposition;
const MemoryAttributes = exporter.MemoryAttributes;
const Template = exporter.Template;
const Error = exporter.Error;
const missing = exporter.missing;

const CallContext = struct {
    allocator: std.mem.Allocator,
};

extern fn _allocateRelocMemory(len: usize, alignment: u16) ?Value;
extern fn _freeRelocMemory(bytes: [*]u8, len: usize, alignment: u16) void;
extern fn _captureString(bytes: ?[*]const u8, len: usize) ?Value;
extern fn _captureView(bytes: ?[*]u8, len: usize, copy: bool) ?Value;
extern fn _castView(structure: Value, dv: Value, writable: bool) ?Value;
extern fn _getViewAddress(dv: Value) usize;
extern fn _readSlot(container: ?Value, slot: usize) ?Value;
extern fn _writeSlot(container: ?Value, slot: usize, object: ?Value) void;
extern fn _beginDefinition() Value;
extern fn _insertInteger(container: Value, key: Value, value: i32) void;
extern fn _insertBoolean(container: Value, key: Value, value: bool) void;
extern fn _insertString(container: Value, key: Value, value: Value) void;
extern fn _insertObject(container: Value, key: Value, value: ?Value) void;
extern fn _beginStructure(def: Value) ?Value;
extern fn _attachMember(structure: Value, def: Value, is_static: bool) void;
extern fn _attachMethod(structure: Value, def: Value, is_static_only: bool) void;
extern fn _attachTemplate(structure: Value, def: Value, is_static: bool) void;
extern fn _finalizeShape(structure: Value) void;
extern fn _endStructure(structure: Value) void;
extern fn _createTemplate(buffer: ?Value) ?Value;
extern fn _writeToConsole(dv: Value) bool;
extern fn _startCall(call: Call, arg_struct: ?Value) *anyopaque;
extern fn _endCall(call: Call, arg_struct: ?Value) void;

fn strlen(s: [*:0]const u8) usize {
    var len: usize = 0;
    while (s[len] != 0) {
        len += 1;
    }
    return len;
}

const allocator: std.mem.Allocator = .{
    .ptr = undefined,
    .vtable = &std.heap.WasmAllocator.vtable,
};

pub fn getPtrAlign(alignment: u16) u8 {
    return if (alignment != 0) std.math.log2_int(u16, alignment) else 0;
}

pub fn allocateExternMemory(len: usize, alignment: u16) ?[*]u8 {
    const ptr_align = getPtrAlign(alignment);
    return allocator.rawAlloc(len, ptr_align, 0);
}

pub fn freeExternMemory(bytes: [*]u8, len: usize, alignment: u16) void {
    const ptr_align = getPtrAlign(alignment);
    allocator.rawFree(bytes[0..len], ptr_align, 0);
}

pub fn allocateShadowMemory(call: Call, len: usize, alignment: u16) ?Value {
    if (len == 0) {
        return _captureView(null, len, false);
    }
    const ptr_align = getPtrAlign(alignment);
    if (call.allocator.rawAlloc(len, ptr_align, 0)) |bytes| {
        return _captureView(bytes, len, false);
    } else {
        return null;
    }
}

pub fn freeShadowMemory(call: Call, bytes: [*]u8, len: usize, alignment: u16) void {
    if (len == 0) {
        return;
    }
    const ptr_align = getPtrAlign(alignment);
    call.allocator.rawFree(bytes[0..len], ptr_align, 0);
}

var initial_context: ?Call = null;

pub const Host = struct {
    context: Call,

    pub fn init(ptr: *anyopaque) Host {
        const context: Call = @ptrCast(@alignCast(ptr));
        if (initial_context == null) {
            initial_context = context;
        }
        return .{ .context = context };
    }

    pub fn release(self: Host) void {
        if (initial_context == self.context) {
            initial_context = null;
        }
    }

    pub fn allocateMemory(_: Host, size: usize, alignment: u16) !Memory {
        if (_allocateRelocMemory(size, alignment)) |dv| {
            const address = _getViewAddress(dv);
            return .{
                .bytes = @ptrFromInt(address),
                .len = size,
            };
        } else {
            return Error.UnableToAllocateMemory;
        }
    }

    pub fn freeMemory(_: Host, memory: Memory) !void {
        if (memory.bytes) |bytes| {
            _freeRelocMemory(bytes, memory.len, memory.attributes.alignment);
        }
    }

    pub fn captureString(_: Host, memory: Memory) !Value {
        if (_captureString(memory.bytes, memory.len)) |str| {
            return str;
        } else {
            return Error.UnableToCreateString;
        }
    }

    pub fn captureView(_: Host, memory: Memory) !Value {
        if (_captureView(memory.bytes, memory.len, memory.attributes.is_comptime)) |dv| {
            return dv;
        } else {
            return Error.UnableToCreateDataView;
        }
    }

    pub fn castView(_: Host, structure: Value, dv: Value, writable: bool) !Value {
        if (_castView(structure, dv, writable)) |object| {
            return object;
        } else {
            return Error.UnableToCreateObject;
        }
    }

    pub fn readSlot(_: Host, container: ?Value, slot: usize) !Value {
        if (_readSlot(container, slot)) |value| {
            return value;
        } else {
            return Error.UnableToRetrieveObject;
        }
    }

    pub fn writeSlot(_: Host, container: ?Value, slot: usize, value: ?Value) !void {
        _writeSlot(container, slot, value);
    }

    fn beginDefinition() Value {
        return _beginDefinition();
    }

    fn insertProperty(container: Value, key: []const u8, value: anytype) !void {
        const T = @TypeOf(value);
        switch (@typeInfo(T)) {
            .Optional => {
                if (value) |v| {
                    return insertProperty(container, key, v);
                }
            },
            else => {},
        }
        const key_str = _captureString(key.ptr, key.len) orelse return Error.UnableToCreateString;
        switch (@typeInfo(T)) {
            .Pointer => {
                if (T == [*:0]const u8) {
                    const str = _captureString(value, strlen(value)) orelse return Error.UnableToCreateString;
                    _insertString(container, key_str, str);
                } else if (T == Value) {
                    _insertObject(container, key_str, value);
                } else {
                    @compileError("No support for value type: " ++ @typeName(T));
                }
            },
            .Int => {
                _insertInteger(container, key_str, @intCast(value));
            },
            .Enum => {
                _insertInteger(container, key_str, @intCast(@intFromEnum(value)));
            },
            .Bool => {
                _insertBoolean(container, key_str, value);
            },
            .Optional => {
                _insertObject(container, key_str, null);
            },
            else => {
                @compileError("No support for value type: " ++ @typeName(T));
            },
        }
    }

    pub fn beginStructure(_: Host, def: Structure) !Value {
        const structure = beginDefinition();
        try insertProperty(structure, "name", def.name);
        try insertProperty(structure, "type", def.structure_type);
        try insertProperty(structure, "length", def.length);
        try insertProperty(structure, "byteSize", def.byte_size);
        try insertProperty(structure, "align", def.alignment);
        try insertProperty(structure, "isConst", def.is_const);
        try insertProperty(structure, "hasPointer", def.has_pointer);
        if (_beginStructure(structure)) |s| {
            return s;
        } else {
            return Error.UnableToStartStructureDefinition;
        }
    }

    pub fn attachMember(_: Host, structure: Value, member: Member, is_static: bool) !void {
        const def = beginDefinition();
        try insertProperty(def, "type", member.member_type);
        try insertProperty(def, "isRequired", member.is_required);
        if (member.bit_offset != missing) {
            try insertProperty(def, "bitOffset", member.bit_offset);
        }
        if (member.bit_size != missing) {
            try insertProperty(def, "bitSize", member.bit_size);
        }
        if (member.byte_size != missing) {
            try insertProperty(def, "byteSize", member.byte_size);
        }
        if (member.slot != missing) {
            try insertProperty(def, "slot", member.slot);
        }
        if (member.name) |name| {
            try insertProperty(def, "name", name);
        }
        if (member.structure) |s| {
            try insertProperty(def, "structure", s);
        }
        _attachMember(structure, def, is_static);
    }

    pub fn finalizeShape(_: Host, structure: Value) !void {
        _finalizeShape(structure);
    }

    pub fn attachMethod(_: Host, structure: Value, method: Method, is_static_only: bool) !void {
        const def = beginDefinition();
        try insertProperty(def, "argStruct", method.structure);
        try insertProperty(def, "thunkId", method.thunk_id);
        if (method.name) |name| {
            try insertProperty(def, "name", name);
        }
        _attachMethod(structure, def, is_static_only);
    }

    pub fn attachTemplate(_: Host, structure: Value, template: Value, is_static: bool) !void {
        _attachTemplate(structure, template, is_static);
    }

    pub fn endStructure(_: Host, structure: Value) !void {
        _endStructure(structure);
    }

    pub fn createTemplate(_: Host, dv: ?Value) !Value {
        if (_createTemplate(dv)) |templ| {
            return templ;
        } else {
            return Error.UnableToCreateStructureTemplate;
        }
    }

    pub fn writeToConsole(_: Host, dv: Value) !void {
        if (!_writeToConsole(dv)) {
            return Error.UnableToWriteToConsole;
        }
    }

    pub fn write(ptr: [*]const u8, len: usize) !void {
        if (initial_context) |context| {
            const host = Host.init(@ptrCast(@constCast(context)));
            const memory: Memory = .{
                .bytes = @constCast(ptr),
                .len = len,
            };
            const dv = try host.captureView(memory);
            try host.writeToConsole(dv);
        } else {
            return Error.UnableToWriteToConsole;
        }
    }
};

pub fn runThunk(thunk_id: usize, arg_struct: ?Value) ?Value {
    // note that std.debug.print() doesn't work here since the initial context is not set
    var fallback_allocator: std.mem.Allocator = .{ .ptr = undefined, .vtable = &std.heap.WasmAllocator.vtable };
    var stack_allocator = std.heap.stackFallback(1024 * 8, fallback_allocator);
    var call_ctx: CallContext = .{ .allocator = stack_allocator.get() };
    const arg_ptr = _startCall(&call_ctx, arg_struct);
    // function pointers in WASM are indices into function table 0
    // so the thunk_id is really the thunk itself
    const thunk: Thunk = @ptrFromInt(thunk_id);
    defer _endCall(&call_ctx, arg_struct);
    if (thunk(@ptrCast(&call_ctx), arg_ptr)) |result| {
        return result;
    } else {
        return null;
    }
}

pub fn defineStructures(comptime T: type) ?Value {
    const factory = exporter.createRootFactory(Host, T);
    const factory_id = @intFromPtr(factory);
    return runThunk(factory_id, null);
}

pub fn isRuntimeSafetyActive() bool {
    return builtin.mode == .ReleaseSafe or builtin.mode == .Debug;
}

pub fn getOS() type {
    return struct {
        pub const system = struct {
            pub const fd_t = u8;
            pub const STDOUT_FILENO = 1;
            pub const STDERR_FILENO = 2;
            pub const E = std.os.linux.E;

            pub fn getErrno(T: usize) E {
                _ = T;
                return .SUCCESS;
            }

            pub fn write(f: fd_t, ptr: [*]const u8, len: usize) usize {
                if (f == STDOUT_FILENO or f == STDERR_FILENO) {
                    if (Host.write(ptr, len)) {
                        return @intCast(len);
                    } else |_| {}
                }
                return len;
            }
        };
    };
}