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

const HostStruct = struct {
    value: usize = 0,
};

fn ref(number: usize) Value {
    return @intToPtr(Value, number);
}

fn index(object: Value) usize {
    return @ptrToInt(object);
}

fn strlen(s: [*:0]const u8) usize {
    var len: usize = 0;
    while (s[len] != 0) {
        len += 1;
    }
    return len;
}

extern "app" fn _createObject() usize;

fn createObject() Value {
    return ref(_createObject());
}

extern "app" fn _setObjectPropertyString(container: usize, address: usize, len: usize) void;
extern "app" fn _setObjectPropertyInteger(container: usize, value: i32) void;
extern "app" fn _setObjectPropertyBoolean(container: usize, value: i32) void;
extern "app" fn _setObjectPropertyObject(container: usize, value: usize) void;

fn setObjectProperty(container: Value, value: anytype) void {
    const T = @TypeOf(value);
    switch (@typeInfo(T)) {
        .Pointer => {
            if (T == [*:0]const u8) {
                _setObjectPropertyString(index(container), @ptrToInt(value), strlen(value));
            } else if (T == Value) {
                _setObjectPropertyObject(index(container), index(value));
            } else {
                @compileError("No support for value type: " ++ @typeName(T));
            }
        },
        .Int => {
            _setObjectPropertyInteger(index(container), @intCast(i32, value));
        },
        .Enum => {
            _setObjectPropertyInteger(index(container), @intCast(i32, @enumToInt(value)));
        },
        .Bool => {
            _setObjectPropertyBoolean(index(container), if (value) 1 else 0);
        },
        .Optional => {
            if (value) |v| {
                setObjectProperty(container, v);
            } else {
                _setObjectPropertyObject(index(container), 0);
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
    const host = @ptrCast(*HostStruct, @alignCast(@alignOf(HostStruct), @constCast(h)));
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

extern "app" fn _getPointerStatus(object: usize) i32;

fn getPointerStatus(_: Host, object: Value, status: *bool) callconv(.C) Result {
    status.* = _getPointerStatus(index(object)) != 0;
    return Result.OK;
}

extern "app" fn _setPointerStatus(object: usize, status: i32) void;

fn setPointerStatus(_: Host, object: Value, status: bool) callconv(.C) Result {
    _setPointerStatus(index(object), if (status) 1 else 0);
    return Result.OK;
}

extern "app" fn _readGlobalSlot(slot: usize) usize;

fn readGlobalSlot(_: Host, slot: usize, dest: *Value) callconv(.C) Result {
    dest.* = ref(_readGlobalSlot(slot));
    return Result.OK;
}

extern "app" fn _writeGlobalSlot(slot: usize, object: usize) void;

fn writeGlobalSlot(_: Host, slot: usize, object: ?Value) callconv(.C) Result {
    _writeGlobalSlot(@truncate(u32, slot), if (object) |obj| index(obj) else 0);
    return Result.OK;
}

extern "app" fn _readObjectSlot(container: usize, slot: usize) usize;

fn readObjectSlot(_: Host, container: Value, slot: usize, dest: *Value) callconv(.C) Result {
    dest.* = ref(_readObjectSlot(index(container), slot));
    return Result.OK;
}

extern "app" fn _writeObjectSlot(container: usize, slot: usize, object: usize) void;

fn writeObjectSlot(_: Host, container: Value, slot: usize, object: ?Value) callconv(.C) Result {
    _writeObjectSlot(index(container), slot, if (object) |obj| index(obj) else 0);
    return Result.OK;
}

extern "app" fn _beginStructure(def: u32) u32;

fn beginStructure(_: Host, structure: *const Structure, dest: *Value) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, structure.*.name);
    setObjectProperty(def, structure.*.structure_type);
    setObjectProperty(def, structure.*.total_size);
    setObjectProperty(def, structure.*.has_pointer);
    dest.* = ref(_beginStructure(index(def)));
    return Result.OK;
}

extern "app" fn _attachMember(structure: usize, def: usize) void;

fn attachMember(_: Host, structure: Value, member: *const Member) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, member.*.is_signed);
    setObjectProperty(def, member.*.member_type);
    setObjectProperty(def, member.*.bit_offset);
    setObjectProperty(def, member.*.bit_size);
    if (member.*.name) |name| {
        setObjectProperty(def, name);
    }
    _attachMember(index(structure), index(def));
    return Result.OK;
}

extern "app" fn _attachMethod(structure: usize, def: usize) void;

fn attachMethod(_: Host, structure: Value, method: *const Method) callconv(.C) Result {
    const def = createObject();
    setObjectProperty(def, method.*.is_static_only);
    setObjectProperty(def, method.*.structure);
    if (method.*.name) |name| {
        setObjectProperty(def, name);
    }
    _attachMethod(index(structure), index(def));
    return Result.OK;
}

extern "app" fn _attachTemplate(structure: usize, def: usize) void;

fn attachTemplate(host: Host, structure: Value, template: *const Template) callconv(.C) Result {
    _ = host;
    const def = createObject();
    setObjectProperty(def, template.*.is_static);
    setObjectProperty(def, template.*.object);
    _attachTemplate(index(structure), index(def));
    return Result.OK;
}

extern "app" fn _finalizeStructure(structure: usize) void;

fn finalizeStructure(_: Host, structure: Value) callconv(.C) Result {
    _finalizeStructure(index(structure));
    return Result.OK;
}

extern "app" fn _createTemplate(address: usize, len: usize) usize;

fn createTemplate(_: Host, memory: *const Memory, dest: *Value) callconv(.C) Result {
    const address = @ptrToInt(memory.*.bytes);
    const len = memory.*.len;
    dest.* = ref(_createTemplate(address, len));
    return Result.OK;
}

extern "app" fn _createString(address: usize, len: usize) usize;

fn createString(_: Host, memory: *const Memory, dest: *Value) callconv(.C) Result {
    const address = @ptrToInt(memory.*.bytes);
    const len = memory.*.len;
    dest.* = ref(_createString(address, len));
    return Result.OK;
}

extern "app" fn _createArray() usize;
extern "app" fn _appendArray(array: usize, value: usize) void;
extern "app" fn _logValues(values: usize) void;

fn logValues(_: Host, argc: usize, argv: [*]Value) callconv(.C) Result {
    const array = _createArray();
    var i: usize = 0;
    while (i < argc) : (i += 1) {
        _appendArray(array, index(argv[i]));
    }
    _logValues(array);
    return Result.OK;
}

extern "app" fn _createFactoryArgument() usize;

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
    const host = @ptrCast(Host, &ctx);
    const arg = createFactoryArgument();
    if (module.factory(host, arg)) |error_msg| {
        return _createString(@ptrToInt(error_msg), strlen(error_msg));
    } else {
        return 0;
    }
}

pub fn exportModule(comptime S: type) usize {
    const module = exporter.createModule(S);
    return runFactory(&module);
}
