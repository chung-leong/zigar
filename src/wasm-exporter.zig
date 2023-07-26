const std = @import("std");
const exporter = @import("exporter.zig");

const Result = exporter.Result;
const Host = exporter.Host;
const Value = exporter.Value;
const Module = exporter.Module;
const StructureType = exporter.StructureType;
const Structure = exporter.Structure;
const MemberType = exporter.MemberType;
const Member = exporter.Member;
const Method = exporter.Method;
const Memory = exporter.Memory;
const MemoryDisposition = exporter.MemoryDisposition;
const Template = exporter.Template;
const Thunk = exporter.Thunk;
const missing = exporter.missing;

const CallContext = struct {
    allocator: std.mem.Allocator,
};

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

extern fn _createObject() usize;

fn createObject() Value {
    return ref(_createObject());
}

extern fn _createString(address: usize, len: usize) usize;

extern fn _setObjectPropertyString(container: usize, key: usize, value: usize) void;
extern fn _setObjectPropertyInteger(container: usize, key: usize, value: i32) void;
extern fn _setObjectPropertyBoolean(container: usize, key: usize, value: i32) void;
extern fn _setObjectPropertyObject(container: usize, key: usize, value: usize) void;

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

export fn alloc(host: Host, len: usize) usize {
    const ctx: *CallContext = @ptrCast(@alignCast(@constCast(host)));
    if (len > 0) {
        if (ctx.allocator.alloc([]u8, len)) |bytes| {
            return @intFromPtr(bytes.ptr);
        } else |_| {
            return 0;
        }
    } else {
        return 0;
    }
}

export fn free(host: Host, address: usize, len: usize) void {
    const ctx: *CallContext = @ptrCast(@alignCast(@constCast(host)));
    const bytes: [*]u8 = @ptrFromInt(address);
    ctx.allocator.free(bytes[0..len]);
}

extern fn _allocMemory(host: usize, size: usize) usize;

fn allocateMemory(host: Host, size: usize, memory: *Memory) callconv(.C) Result {
    const address = _allocMemory(@intFromPtr(host), size);
    if (address == 0) {
        return Result.Failure;
    }
    memory.* = .{
        .bytes = @ptrFromInt(address),
        .len = size,
    };
    return Result.OK;
}

extern fn _freeMemory(host: usize, address: usize, len: usize) void;

fn freeMemory(host: Host, memory: *const Memory) callconv(.C) Result {
    _freeMemory(@intFromPtr(host), @intFromPtr(memory.bytes), memory.len);
    return Result.OK;
}

extern fn _getMemory(host: usize, object: usize) usize;
extern fn _getMemoryOffset(object: usize) usize;
extern fn _getMemoryLength(object: usize) usize;

fn getMemory(host: Host, object: Value, memory: *Memory) callconv(.C) Result {
    const view_index = _getMemory(@intFromPtr(host), index(object));
    if (view_index == 0) {
        return Result.Failure;
    }
    const len = _getMemoryLength(view_index);
    const offset = _getMemoryOffset(view_index);
    memory.* = .{
        .bytes = @ptrFromInt(offset),
        .len = len,
    };
    return Result.OK;
}

extern fn _createDataView(host: usize, address: usize, len: usize, disposition: u32) usize;

fn createDataView(host: Host, memory: *const Memory, disposition: MemoryDisposition) ?Value {
    const bytes = memory.bytes orelse return null;
    const len = memory.len;
    const address = @intFromPtr(bytes);
    const dv_index = _createDataView(@intFromPtr(host), address, len, @intFromEnum(disposition));
    if (dv_index == 0) {
        return null;
    }
    return ref(dv_index);
}

extern fn _wrapMemory(structure: usize, view: usize) usize;

fn wrapMemory(host: Host, structure: Value, memory: *const Memory, disposition: MemoryDisposition, dest: *Value) callconv(.C) Result {
    const dv = createDataView(host, memory, disposition) orelse return Result.Failure;
    const obj_index = _wrapMemory(index(structure), index(dv));
    if (obj_index == 0) {
        return Result.Failure;
    }
    dest.* = ref(obj_index);
    return Result.OK;
}

extern fn _getPointerStatus(object: usize) i32;

fn getPointerStatus(_: Host, object: Value, status: *bool) callconv(.C) Result {
    const value = _getPointerStatus(index(object));
    if (value == -1) {
        return Result.Failure;
    }
    status.* = (value != 0);
    return Result.OK;
}

extern fn _setPointerStatus(object: usize, status: i32) void;

fn setPointerStatus(_: Host, object: Value, status: bool) callconv(.C) Result {
    _setPointerStatus(index(object), if (status) 1 else 0);
    return Result.OK;
}

extern fn _readGlobalSlot(slot: usize) usize;

fn readGlobalSlot(_: Host, slot: usize, dest: *Value) callconv(.C) Result {
    const obj_index = _readGlobalSlot(slot);
    if (obj_index == 0) {
        return Result.Failure;
    }
    dest.* = ref(obj_index);
    return Result.OK;
}

extern fn _writeGlobalSlot(slot: usize, object: usize) void;

fn writeGlobalSlot(_: Host, slot: usize, object: ?Value) callconv(.C) Result {
    _writeGlobalSlot(@truncate(slot), index(object));
    return Result.OK;
}

extern fn _readObjectSlot(container: usize, slot: usize) usize;

fn readObjectSlot(_: Host, container: Value, slot: usize, dest: *Value) callconv(.C) Result {
    const obj_index = _readObjectSlot(index(container), slot);
    if (obj_index == 0) {
        return Result.Failure;
    }
    dest.* = ref(obj_index);
    return Result.OK;
}

extern fn _writeObjectSlot(container: usize, slot: usize, object: usize) void;

fn writeObjectSlot(_: Host, container: Value, slot: usize, object: ?Value) callconv(.C) Result {
    _writeObjectSlot(index(container), slot, index(object));
    return Result.OK;
}

extern fn _beginStructure(def: u32) u32;

fn beginStructure(_: Host, structure: *const Structure, dest: *Value) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "name", structure.name);
    setObjectProperty(def, "type", structure.structure_type);
    setObjectProperty(def, "size", structure.total_size);
    setObjectProperty(def, "hasPointer", structure.has_pointer);
    dest.* = ref(_beginStructure(index(def)));
    return Result.OK;
}

extern fn _attachMember(structure: usize, def: usize) void;

fn attachMember(_: Host, structure: Value, member: *const Member) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "type", member.member_type);
    setObjectProperty(def, "isSigned", member.is_signed);
    setObjectProperty(def, "isConst", member.is_const);
    setObjectProperty(def, "isRequired", member.is_required);
    setObjectProperty(def, "isStatic", member.is_static);
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
    _attachMember(index(structure), index(def));
    return Result.OK;
}

extern fn _attachMethod(structure: usize, def: usize) void;

fn attachMethod(_: Host, structure: Value, method: *const Method) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "isStatic", method.is_static_only);
    setObjectProperty(def, "argStruct", method.structure);
    setObjectProperty(def, "thunk", @intFromPtr(method.thunk));
    if (method.name) |name| {
        setObjectProperty(def, "name", name);
    }
    _attachMethod(index(structure), index(def));
    return Result.OK;
}

extern fn _attachTemplate(structure: usize, def: usize) void;

fn attachTemplate(_: Host, structure: Value, template: *const Template) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "isStatic", template.is_static);
    setObjectProperty(def, "template", template.object);
    _attachTemplate(index(structure), index(def));
    return Result.OK;
}

extern fn _finalizeStructure(structure: usize) void;

fn finalizeStructure(_: Host, structure: Value) callconv(.C) Result {
    _finalizeStructure(index(structure));
    return Result.OK;
}

extern fn _createTemplate(buffer: usize) usize;

fn createTemplate(host: Host, memory: *const Memory, dest: *Value) callconv(.C) Result {
    const dv = createDataView(host, memory, .Copy);
    const templ_index = _createTemplate(index(dv));
    if (templ_index == 0) {
        return Result.Failure;
    }
    dest.* = ref(templ_index);
    return Result.OK;
}

fn createString(_: Host, memory: *const Memory, dest: *Value) callconv(.C) Result {
    const address = @intFromPtr(memory.bytes);
    const len = memory.len;
    dest.* = ref(_createString(address, len));
    return Result.OK;
}

extern fn _createArray() usize;
extern fn _appendArray(array: usize, value: usize) void;
extern fn _logValues(values: usize) void;

fn logValues(_: Host, argc: usize, argv: [*]Value) callconv(.C) Result {
    const array = _createArray();
    var i: usize = 0;
    while (i < argc) : (i += 1) {
        _appendArray(array, index(argv[i]));
    }
    _logValues(array);
    return Result.OK;
}

pub fn setCallbacks() void {
    const ptr = &exporter.callbacks;
    ptr.allocate_memory = allocateMemory;
    ptr.free_memory = freeMemory;
    ptr.get_memory = getMemory;
    ptr.wrap_memory = wrapMemory;
    ptr.get_pointer_status = getPointerStatus;
    ptr.set_pointer_status = setPointerStatus;
    ptr.read_global_slot = readGlobalSlot;
    ptr.write_global_slot = writeGlobalSlot;
    ptr.read_object_slot = readObjectSlot;
    ptr.write_object_slot = writeObjectSlot;
    ptr.begin_structure = beginStructure;
    ptr.attach_member = attachMember;
    ptr.attach_method = attachMethod;
    ptr.attach_template = attachTemplate;
    ptr.finalize_structure = finalizeStructure;
    ptr.create_template = createTemplate;
    ptr.create_string = createString;
    ptr.log_values = logValues;
}

extern fn _startCall(host: usize) void;
extern fn _endCall(host: usize) void;

pub fn runThunk(arg_index: usize, address: usize) usize {
    var ctx: CallContext = .{
        .allocator = .{ .ptr = undefined, .vtable = &std.heap.WasmAllocator.vtable },
    };
    const thunk: Thunk = @ptrFromInt(address);
    const host: Host = @ptrCast(&ctx);
    _startCall(@intFromPtr(host));
    const result = thunk(host, ref(arg_index));
    _endCall(@intFromPtr(host));
    if (result) |error_msg| {
        return _createString(@intFromPtr(error_msg), strlen(error_msg));
    } else {
        return 0;
    }
}

pub fn exportModule(comptime T: type, arg_index: usize) usize {
    const factory = exporter.createRootFactory(T);
    return runThunk(arg_index, @intFromPtr(factory));
}
