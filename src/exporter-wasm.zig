const exporter = @import("exporter.zig");

const Result = exporter.Result;
const Host = exporter.Host;
const Value = exporter.Value;
const Module = exporter.Module;
const StructureType = exporter.StructureType;
const Structure = exporter.Structure;
const MemberType = exporter.MemberType;
const Member = exporter.Member;
const Memory = exporter.Memory;
const Method = exporter.Method;
const Template = exporter.Template;
const Thunk = exporter.Thunk;
const missing = exporter.missing;

const HostStruct = struct {
    value: usize = 0,
};

fn ref(number: usize) Value {
    return @ptrFromInt(number);
}

fn index(object: Value) usize {
    return @intFromPtr(object);
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

fn allocateMemory(h: Host, size: usize, memory: *Memory) callconv(.C) Result {
    _ = memory;
    _ = size;
    const host: *HostStruct = @ptrCast(@alignCast(@constCast(h)));
    _ = host;
    return Result.OK;
}

fn freeMemory(host: Host, memory: *const Memory) callconv(.C) Result {
    _ = memory;
    _ = host;
    return Result.OK;
}

fn getMemory(host: Host, object: Value, memory: *Memory) callconv(.C) Result {
    _ = memory;
    _ = object;
    _ = host;
    return Result.OK;
}

fn wrapMemory(host: Host, structure: Value, memory: *const Memory, dest: *Value) callconv(.C) Result {
    _ = dest;
    _ = memory;
    _ = structure;
    _ = host;
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
    _writeGlobalSlot(@truncate(slot), if (object) |obj| index(obj) else 0);
    return Result.OK;
}

extern fn _readObjectSlot(container: usize, slot: usize) usize;

fn readObjectSlot(_: Host, container: Value, slot: usize, dest: *Value) callconv(.C) Result {
    dest.* = ref(_readObjectSlot(index(container), slot));
    return Result.OK;
}

extern fn _writeObjectSlot(container: usize, slot: usize, object: usize) void;

fn writeObjectSlot(_: Host, container: Value, slot: usize, object: ?Value) callconv(.C) Result {
    _writeObjectSlot(index(container), slot, if (object) |obj| index(obj) else 0);
    return Result.OK;
}

extern fn _beginStructure(def: u32) u32;

fn beginStructure(_: Host, structure: *const Structure, dest: *Value) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "name", structure.*.name);
    setObjectProperty(def, "type", structure.*.structure_type);
    setObjectProperty(def, "size", structure.*.total_size);
    setObjectProperty(def, "hasPointer", structure.*.has_pointer);
    dest.* = ref(_beginStructure(index(def)));
    return Result.OK;
}

extern fn _attachMember(structure: usize, def: usize) void;

fn attachMember(_: Host, structure: Value, member: *const Member) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "type", member.*.member_type);
    setObjectProperty(def, "isSigned", member.*.is_signed);
    setObjectProperty(def, "isConst", member.*.is_const);
    setObjectProperty(def, "isRequired", member.*.is_required);
    if (member.*.bit_offset != missing) {
        setObjectProperty(def, "bitOffset", member.*.bit_offset);
    }
    if (member.*.bit_size != missing) {
        setObjectProperty(def, "bitSize", member.*.bit_size);
    }
    if (member.*.byte_size != missing) {
        setObjectProperty(def, "byteSize", member.*.byte_size);
    }
    if (member.*.slot != missing) {
        setObjectProperty(def, "slot", member.*.slot);
    }
    if (member.*.name) |name| {
        setObjectProperty(def, "name", name);
    }
    _attachMember(index(structure), index(def));
    return Result.OK;
}

extern fn _attachMethod(structure: usize, def: usize) void;

fn attachMethod(_: Host, structure: Value, method: *const Method) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "isStatic", method.*.is_static_only);
    setObjectProperty(def, "structure", method.*.structure);
    if (method.*.name) |name| {
        setObjectProperty(def, "name", name);
    }
    _attachMethod(index(structure), index(def));
    return Result.OK;
}

extern fn _attachTemplate(structure: usize, def: usize) void;

fn attachTemplate(_: Host, structure: Value, template: *const Template) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, "isStatic", template.*.is_static);
    setObjectProperty(def, "template", template.*.object);
    _attachTemplate(index(structure), index(def));
    return Result.OK;
}

extern fn _finalizeStructure(structure: usize) void;

fn finalizeStructure(_: Host, structure: Value) callconv(.C) Result {
    _finalizeStructure(index(structure));
    return Result.OK;
}

extern fn _createDataView(address: usize, len: usize, copy: i32) usize;

extern fn _createTemplate(buffer: usize) usize;

fn createTemplate(host: Host, memory: *const Memory, dest: *Value) callconv(.C) Result {
    const stack_top = @intFromPtr(host) + @sizeOf(HostStruct);
    const stack_bottom = @intFromPtr(&stack_top);
    const address = @intFromPtr(memory.bytes);
    const len = memory.*.len;
    const copy = (stack_bottom <= address and address + len <= stack_top);
    const dv_index = _createDataView(address, len, if (copy) 1 else 0);
    dest.* = ref(_createTemplate(dv_index));
    return Result.OK;
}

fn createString(_: Host, memory: *const Memory, dest: *Value) callconv(.C) Result {
    const address = @intFromPtr(memory.*.bytes);
    const len = memory.*.len;
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

extern fn _createFactoryArgument() usize;

fn createFactoryArgument() Value {
    return ref(_createFactoryArgument());
}

fn setCallbacks(module: *const Module) void {
    const ptr = module.*.callbacks;
    ptr.*.allocate_memory = allocateMemory;
    ptr.*.free_memory = freeMemory;
    ptr.*.get_memory = getMemory;
    ptr.*.wrap_memory = wrapMemory;
    ptr.*.get_pointer_status = getPointerStatus;
    ptr.*.set_pointer_status = setPointerStatus;
    ptr.*.read_global_slot = readGlobalSlot;
    ptr.*.write_global_slot = writeGlobalSlot;
    ptr.*.read_object_slot = readObjectSlot;
    ptr.*.write_object_slot = writeObjectSlot;
    ptr.*.begin_structure = beginStructure;
    ptr.*.attach_member = attachMember;
    ptr.*.attach_method = attachMethod;
    ptr.*.attach_template = attachTemplate;
    ptr.*.finalize_structure = finalizeStructure;
    ptr.*.create_template = createTemplate;
    ptr.*.create_string = createString;
    ptr.*.log_values = logValues;
}

fn runFactory(module: *const Module) usize {
    setCallbacks(module);
    var ctx: HostStruct = .{};
    const host: Host = @ptrCast(&ctx);
    const arg = createFactoryArgument();
    if (module.factory(host, arg)) |error_msg| {
        return _createString(@intFromPtr(error_msg), strlen(error_msg));
    } else {
        return 0;
    }
}

pub fn exportModule(comptime S: type) usize {
    const module = exporter.createModule(S);
    return runFactory(&module);
}
