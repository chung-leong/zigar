const std = @import("std");
const builtin = @import("builtin");
const exporter = @import("exporter.zig");

const Value = exporter.Value;
const StructureType = exporter.StructureType;
const Structure = exporter.Structure;
const MemberType = exporter.MemberType;
const Member = exporter.Member;
const Method = exporter.Method;
const Memory = exporter.Memory;
const MemoryDisposition = exporter.MemoryDisposition;
const Template = exporter.Template;
const Thunk = exporter.Thunk;
const Error = exporter.Error;
const missing = exporter.missing;

const Call = struct {
    allocator: std.mem.Allocator,
};

extern fn _allocMemory(host: usize, len: usize, ptr_align: u8) usize;
extern fn _freeMemory(host: usize, address: usize, len: usize, ptr_align: u8) void;
extern fn _getMemory(host: usize, object: usize, ptr_align: u8) usize;
extern fn _getMemoryOffset(object: usize) usize;
extern fn _getMemoryLength(object: usize) usize;
extern fn _createDataView(host: usize, address: usize, len: usize, disposition: u32) usize;
extern fn _wrapMemory(structure: usize, view: usize) usize;
extern fn _getPointerStatus(object: usize) i32;
extern fn _setPointerStatus(object: usize, status: i32) void;
extern fn _readGlobalSlot(slot: usize) usize;
extern fn _writeGlobalSlot(slot: usize, object: usize) void;
extern fn _readObjectSlot(container: usize, slot: usize) usize;
extern fn _writeObjectSlot(container: usize, slot: usize, object: usize) void;
extern fn _beginStructure(def: u32) u32;
extern fn _attachMember(structure: usize, def: usize, is_static: i32) void;
extern fn _attachMethod(structure: usize, def: usize, is_static_only: i32) void;
extern fn _attachTemplate(structure: usize, def: usize, is_static: i32) void;
extern fn _finalizeStructure(structure: usize) void;
extern fn _createTemplate(buffer: usize) usize;
extern fn _writeToConsole(address: usize, len: usize) void;
extern fn _createObject() usize;
extern fn _createString(address: usize, len: usize) usize;
extern fn _setObjectPropertyString(container: usize, key: usize, value: usize) void;
extern fn _setObjectPropertyInteger(container: usize, key: usize, value: i32) void;
extern fn _setObjectPropertyBoolean(container: usize, key: usize, value: i32) void;
extern fn _setObjectPropertyObject(container: usize, key: usize, value: usize) void;
extern fn _startCall(host: usize) void;
extern fn _endCall(host: usize) void;

fn ref(number: usize) Value {
    return @ptrFromInt(number);
}

fn index(object: ?Value) usize {
    return if (object) |ptr| @intFromPtr(ptr) else 0;
}

fn strlen(s: [*:0]const u8) usize {
    var len: usize = 0;
    while (s[len] != 0) {
        len += 1;
    }
    return len;
}

pub fn alloc(ptr: *anyopaque, len: usize, ptr_align: u8) usize {
    const ctx: *Call = @alignCast(@ptrCast(ptr));
    if (len > 0) {
        if (ctx.allocator.rawAlloc(len, ptr_align, 0)) |bytes| {
            return @intFromPtr(bytes);
        } else {
            return 0;
        }
    } else {
        return 0;
    }
}

pub fn free(ptr: *anyopaque, address: usize, len: usize, ptr_align: u8) void {
    const ctx: *Call = @alignCast(@ptrCast(ptr));
    const bytes: [*]u8 = @ptrFromInt(address);
    ctx.allocator.rawFree(bytes[0..len], ptr_align, 0);
}

pub const Host = struct {
    context: u32,

    pub const RuntimeHost = Host;

    pub fn init(ptr: *anyopaque) Host {
        return .{ .context = @intFromPtr(ptr) };
    }

    pub fn done(_: Host) void {}

    pub fn allocateMemory(self: Host, size: usize, ptr_align: u8) !Memory {
        const address = _allocMemory(self.context, size, ptr_align);
        if (address == 0) {
            return Error.UnableToAllocateMemory;
        }
        return .{
            .bytes = @ptrFromInt(address),
            .len = size,
        };
    }

    pub fn freeMemory(self: Host, memory: Memory, ptr_align: u8) !void {
        _freeMemory(self.context, @intFromPtr(memory.bytes), memory.len, ptr_align);
    }

    pub fn getMemory(self: Host, container: Value, comptime T: type, comptime size: std.builtin.Type.Pointer.Size, comptime aligning: bool) !exporter.PointerType(T, size) {
        const ptr_align = if (aligning) std.math.log2_int(u8, @alignOf(T)) else 0;
        const view_index = _getMemory(self.context, index(container), ptr_align);
        if (view_index == 0) {
            return Error.UnableToRetrieveMemoryLocation;
        }
        const len = _getMemoryLength(view_index);
        const offset = _getMemoryOffset(view_index);
        const memory: Memory = .{
            .bytes = @ptrFromInt(offset),
            .len = len,
        };
        return exporter.fromMemory(memory, T, size);
    }

    pub noinline fn onStack(self: Host, memory: Memory) bool {
        const bytes = memory.bytes orelse return false;
        const len = memory.len;
        // self.context is a pointer to a Call object created on the stack in runThunk()
        const stack_top = self.context + @sizeOf(Call);
        const stack_bottom = @intFromPtr(&bytes);
        const address = @intFromPtr(bytes);
        return (stack_bottom <= address and address + len <= stack_top);
    }

    fn createDataView(self: Host, memory: Memory, disposition: MemoryDisposition) ?Value {
        const bytes = memory.bytes orelse return null;
        const len = memory.len;
        const address = @intFromPtr(bytes);
        const dv_index = _createDataView(self.context, address, len, @intFromEnum(disposition));
        if (dv_index == 0) {
            return null;
        }
        return ref(dv_index);
    }

    pub fn wrapMemory(self: Host, memory: Memory, disposition: MemoryDisposition, comptime T: type, comptime size: std.builtin.Type.Pointer.Size) !Value {
        const dv = self.createDataView(memory, disposition) orelse return Error.UnableToCreateObject;
        const slot = exporter.getStructureSlot(T, size);
        const structure = try self.readGlobalSlot(slot);
        const obj_index = _wrapMemory(index(structure), index(dv));
        if (obj_index == 0) {
            return Error.UnableToCreateObject;
        }
        return ref(obj_index);
    }

    pub fn getPointerStatus(_: Host, pointer: Value) !bool {
        const value = _getPointerStatus(index(pointer));
        if (value == -1) {
            return Error.PointerIsInvalid;
        }
        return (value != 0);
    }

    pub fn setPointerStatus(_: Host, pointer: Value, sync: bool) !void {
        _setPointerStatus(index(pointer), if (sync) 1 else 0);
    }

    pub fn readGlobalSlot(_: Host, slot: usize) !Value {
        const obj_index = _readGlobalSlot(slot);
        if (obj_index == 0) {
            return Error.UnableToFindObjectType;
        }
        return ref(obj_index);
    }

    pub fn writeGlobalSlot(_: Host, slot: usize, value: Value) !void {
        _writeGlobalSlot(@truncate(slot), index(value));
    }

    pub fn readObjectSlot(_: Host, container: Value, slot: usize) !Value {
        const obj_index = _readObjectSlot(index(container), slot);
        if (obj_index == 0) {
            return Error.UnableToRetrieveObject;
        }
        return ref(obj_index);
    }

    pub fn writeObjectSlot(_: Host, container: Value, slot: usize, value: ?Value) !void {
        _writeObjectSlot(index(container), slot, index(value));
    }

    fn createObject() Value {
        return ref(_createObject());
    }

    fn setObjectProperty(container: Value, key: []const u8, value: anytype) void {
        const T = @TypeOf(value);
        const key_index = _createString(@intFromPtr(key.ptr), key.len);
        switch (@typeInfo(T)) {
            .Pointer => {
                if (T == [*:0]const u8) {
                    const value_index = _createString(@intFromPtr(value), strlen(value));
                    _setObjectPropertyString(index(container), key_index, value_index);
                } else if (T == Value) {
                    _setObjectPropertyObject(index(container), key_index, index(value));
                } else {
                    @compileError("No support for value type: " ++ @typeName(T));
                }
            },
            .Int => {
                _setObjectPropertyInteger(index(container), key_index, @intCast(value));
            },
            .Enum => {
                _setObjectPropertyInteger(index(container), key_index, @intCast(@intFromEnum(value)));
            },
            .Bool => {
                _setObjectPropertyBoolean(index(container), key_index, if (value) 1 else 0);
            },
            .Optional => {
                if (value) |v| {
                    setObjectProperty(container, key, v);
                } else {
                    _setObjectPropertyObject(index(container), key_index, 0);
                }
            },
            else => {
                @compileError("No support for value type: " ++ @typeName(T));
            },
        }
    }

    pub fn beginStructure(_: Host, def: Structure) !Value {
        const structure = createObject();
        setObjectProperty(structure, "name", def.name);
        setObjectProperty(structure, "type", def.structure_type);
        setObjectProperty(structure, "size", def.total_size);
        setObjectProperty(structure, "isConst", def.is_const);
        setObjectProperty(structure, "hasPointer", def.has_pointer);
        return ref(_beginStructure(index(structure)));
    }

    pub fn attachMember(self: Host, structure: Value, member: Member, is_static: bool) !void {
        _ = self;
        const def = createObject();
        setObjectProperty(def, "type", member.member_type);
        if (member.member_type == MemberType.Int) {
            setObjectProperty(def, "isSigned", member.is_signed);
        }
        setObjectProperty(def, "isRequired", member.is_required);
        if (member.bit_offset != missing) {
            setObjectProperty(def, "bitOffset", member.bit_offset);
        }
        if (member.bit_size != missing) {
            setObjectProperty(def, "bitSize", member.bit_size);
        }
        if (member.byte_size != missing) {
            setObjectProperty(def, "byteSize", member.byte_size);
        }
        if (member.slot != missing) {
            setObjectProperty(def, "slot", member.slot);
        }
        if (member.name) |name| {
            setObjectProperty(def, "name", name);
        }
        if (member.structure) |s| {
            setObjectProperty(def, "structure", s);
        }
        _attachMember(index(structure), index(def), if (is_static) 1 else 0);
    }

    pub fn attachMethod(_: Host, structure: Value, method: Method, is_static_only: bool) !void {
        const def = createObject();
        setObjectProperty(def, "argStruct", method.structure);
        setObjectProperty(def, "thunk", @intFromPtr(method.thunk));
        if (method.name) |name| {
            setObjectProperty(def, "name", name);
        }
        _attachMethod(index(structure), index(def), if (is_static_only) 1 else 0);
    }

    pub fn attachTemplate(_: Host, structure: Value, template: Value, is_static: bool) !void {
        _attachTemplate(index(structure), index(template), if (is_static) 1 else 0);
    }

    pub fn finalizeStructure(_: Host, structure: Value) !void {
        _finalizeStructure(index(structure));
    }

    pub fn createTemplate(self: Host, bytes: []u8) !Value {
        const memory: Memory = .{
            .bytes = if (bytes.len > 0) bytes.ptr else null,
            .len = bytes.len,
        };
        const dv = self.createDataView(memory, .Copy);
        const templ_index = _createTemplate(index(dv));
        if (templ_index == 0) {
            return Error.UnableToCreateStructureTemplate;
        }
        return ref(templ_index);
    }
};

pub fn runThunk(arg_index: usize, address: usize) usize {
    var ctx: Call = .{
        .allocator = .{ .ptr = undefined, .vtable = &std.heap.WasmAllocator.vtable },
    };
    const thunk: Thunk = @ptrFromInt(address);
    const ptr: *anyopaque = @ptrCast(&ctx);
    _startCall(@intFromPtr(ptr));
    const result = thunk(ptr, ref(arg_index));
    _endCall(@intFromPtr(ptr));
    if (result) |error_msg| {
        return _createString(@intFromPtr(error_msg), strlen(error_msg));
    } else {
        return 0;
    }
}

pub fn exportModule(comptime T: type, arg_index: usize) usize {
    const factory = exporter.createRootFactory(Host, T);
    return runThunk(arg_index, @intFromPtr(factory));
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
                    _writeToConsole(@intFromPtr(ptr), len);
                }
                return len;
            }
        };
    };
}

pub fn getRuntimeSafety() u8 {
    return if (builtin.mode == .ReleaseSafe or builtin.mode == .Debug) 1 else 0;
}
