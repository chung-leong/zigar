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
const MemoryAttributes = exporter.MemoryAttributes;
const Template = exporter.Template;
const Thunk = exporter.Thunk;
const Error = exporter.Error;
const missing = exporter.missing;

const CallContext = struct {
    allocator: std.mem.Allocator,
};
const Call = *const CallContext;

extern fn _setCallContext(address: usize) void;
extern fn _allocMemory(len: usize, ptr_align: u8) usize;
extern fn _freeMemory(address: usize, len: usize, ptr_align: u8) void;
extern fn _createString(address: usize, len: usize) usize;
extern fn _createObject(structure: usize, dv: usize) usize;
extern fn _createView(address: usize, len: usize) usize;
extern fn _castView(structure: usize, dv: usize) usize;
extern fn _readSlot(container: usize, slot: usize) usize;
extern fn _writeSlot(container: usize, slot: usize, object: usize) void;
extern fn _beginDefinition() usize;
extern fn _insertInteger(container: usize, key: usize, value: i32) void;
extern fn _insertBoolean(container: usize, key: usize, value: i32) void;
extern fn _insertString(container: usize, key: usize, value: usize) void;
extern fn _insertObject(container: usize, key: usize, value: usize) void;
extern fn _beginStructure(def: u32) u32;
extern fn _attachMember(structure: usize, def: usize, is_static: i32) void;
extern fn _attachMethod(structure: usize, def: usize, is_static_only: i32) void;
extern fn _attachTemplate(structure: usize, def: usize, is_static: i32) void;
extern fn _finalizeStructure(structure: usize) void;
extern fn _createTemplate(buffer: usize) usize;
extern fn _writeToConsole(address: usize, len: usize) void;

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
    const ctx: Call = @alignCast(@ptrCast(ptr));
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
    const ctx: Call = @alignCast(@ptrCast(ptr));
    const bytes: [*]u8 = @ptrFromInt(address);
    ctx.allocator.rawFree(bytes[0..len], ptr_align, 0);
}

pub const Host = struct {
    context: Call,

    var initial_context: ?Call = null;

    pub fn init(ptr: *anyopaque) Host {
        const context: Call = @ptrCast(@alignCast(ptr));
        if (initial_context == null) {
            initial_context = context;
        }
        _setCallContext(@intFromPtr(ptr));
        return .{ .context = context };
    }

    pub fn release(self: Host) void {
        if (initial_context == self.context) {
            initial_context = null;
        }
    }

    pub fn allocateMemory(_: Host, size: usize, ptr_align: u8) !Memory {
        const address = _allocMemory(size, ptr_align);
        if (address == 0) {
            return Error.UnableToAllocateMemory;
        }
        return .{
            .bytes = @ptrFromInt(address),
            .len = size,
        };
    }

    pub fn freeMemory(_: Host, memory: Memory, ptr_align: u8) !void {
        _freeMemory(@intFromPtr(memory.bytes), memory.len, ptr_align);
    }

    pub fn createString(_: Host, memory: Memory) !Value {
        const bytes = memory.bytes;
        const len = memory.len;
        const address = @intFromPtr(bytes);
        const str_index = _createString(address, len);
        if (str_index == 0) {
            return Error.UnableToCreateString;
        }
        return ref(str_index);
    }

    pub fn createObject(_: Host, structure: Value, arg: Value) !Value {
        const value_index = _createObject(index(structure), index(arg));
        if (value_index == 0) {
            return Error.UnableToCreateObject;
        }
        return ref(value_index);
    }

    pub fn createView(_: Host, memory: Memory) !Value {
        const bytes = memory.bytes;
        const len = memory.len;
        const address = @intFromPtr(bytes);
        const dv_index = _createView(address, len);
        if (dv_index == 0) {
            return Error.UnableToCreateDataView;
        }
        return ref(dv_index);
    }

    pub fn castView(_: Host, structure: Value, dv: Value) !Value {
        const value_index = _castView(index(structure), index(dv));
        if (value_index == 0) {
            return Error.UnableToCreateObject;
        }
        return ref(value_index);
    }

    pub fn readSlot(_: Host, container: ?Value, slot: usize) !Value {
        const obj_index = _readSlot(index(container), slot);
        if (obj_index == 0) {
            return Error.UnableToRetrieveObject;
        }
        return ref(obj_index);
    }

    pub fn writeSlot(_: Host, container: ?Value, slot: usize, value: ?Value) !void {
        _writeSlot(index(container), slot, index(value));
    }

    fn beginDefinition() Value {
        return ref(_beginDefinition());
    }

    fn insertProperty(container: Value, key: []const u8, value: anytype) void {
        const T = @TypeOf(value);
        const key_index = _createString(@intFromPtr(key.ptr), key.len);
        switch (@typeInfo(T)) {
            .Pointer => {
                if (T == [*:0]const u8) {
                    const value_index = _createString(@intFromPtr(value), strlen(value));
                    _insertString(index(container), key_index, value_index);
                } else if (T == Value) {
                    _insertObject(index(container), key_index, index(value));
                } else {
                    @compileError("No support for value type: " ++ @typeName(T));
                }
            },
            .Int => {
                _insertInteger(index(container), key_index, @intCast(value));
            },
            .Enum => {
                _insertInteger(index(container), key_index, @intCast(@intFromEnum(value)));
            },
            .Bool => {
                _insertBoolean(index(container), key_index, if (value) 1 else 0);
            },
            .Optional => {
                if (value) |v| {
                    insertProperty(container, key, v);
                } else {
                    _insertObject(index(container), key_index, 0);
                }
            },
            else => {
                @compileError("No support for value type: " ++ @typeName(T));
            },
        }
    }

    pub fn beginStructure(_: Host, def: Structure) !Value {
        const structure = beginDefinition();
        insertProperty(structure, "name", def.name);
        insertProperty(structure, "type", def.structure_type);
        insertProperty(structure, "length", def.length);
        insertProperty(structure, "byteSize", def.byte_size);
        insertProperty(structure, "align", def.ptr_align);
        insertProperty(structure, "isConst", def.is_const);
        insertProperty(structure, "hasPointer", def.has_pointer);
        return ref(_beginStructure(index(structure)));
    }

    pub fn attachMember(_: Host, structure: Value, member: Member, is_static: bool) !void {
        const def = beginDefinition();
        insertProperty(def, "type", member.member_type);
        insertProperty(def, "isRequired", member.is_required);
        if (member.bit_offset != missing) {
            insertProperty(def, "bitOffset", member.bit_offset);
        }
        if (member.bit_size != missing) {
            insertProperty(def, "bitSize", member.bit_size);
        }
        if (member.byte_size != missing) {
            insertProperty(def, "byteSize", member.byte_size);
        }
        if (member.slot != missing) {
            insertProperty(def, "slot", member.slot);
        }
        if (member.name) |name| {
            insertProperty(def, "name", name);
        }
        if (member.structure) |s| {
            insertProperty(def, "structure", s);
        }
        _attachMember(index(structure), index(def), if (is_static) 1 else 0);
    }

    pub fn attachMethod(_: Host, structure: Value, method: Method, is_static_only: bool) !void {
        const def = beginDefinition();
        insertProperty(def, "argStruct", method.structure);
        insertProperty(def, "thunk", @intFromPtr(method.thunk));
        if (method.name) |name| {
            insertProperty(def, "name", name);
        }
        _attachMethod(index(structure), index(def), if (is_static_only) 1 else 0);
    }

    pub fn attachTemplate(_: Host, structure: Value, template: Value, is_static: bool) !void {
        _attachTemplate(index(structure), index(template), if (is_static) 1 else 0);
    }

    pub fn finalizeStructure(_: Host, structure: Value) !void {
        _finalizeStructure(index(structure));
    }

    pub fn createTemplate(_: Host, dv: ?Value) !Value {
        const templ_index = _createTemplate(index(dv));
        if (templ_index == 0) {
            return Error.UnableToCreateStructureTemplate;
        }
        return ref(templ_index);
    }

    pub fn writeToConsole(_: Host, dv: Value) !void {
        const result = _writeToConsole(dv);
        if (result == 0) {
            return Error.UnableToWriteToConsole;
        }
    }

    pub fn write(ptr: [*]const u8, len: usize) !void {
        if (initial_context) |context| {
            const host = Host.init(context);
            const memory: Memory = .{
                .bytes = @constCast(ptr),
                .len = len,
            };
            const dv = try host.createView(memory);
            try host.writeToConsole(dv);
        } else {
            return Error.UnableToWriteToConsole;
        }
    }
};

pub fn runThunk(fn_address: usize, arg_address: usize) usize {
    var ctx: CallContext = .{
        .allocator = .{ .ptr = undefined, .vtable = &std.heap.WasmAllocator.vtable },
    };
    const ptr: *anyopaque = @ptrCast(&ctx);
    const thunk: Thunk = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = @ptrFromInt(arg_address);
    if (thunk(ptr, arg_ptr)) |result| {
        return index(result);
    } else {
        return 0;
    }
}

pub fn exportModule(comptime T: type) usize {
    const factory = exporter.createRootFactory(Host, T);
    const fn_address: usize = @intFromPtr(factory);
    return runThunk(fn_address, 0);
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

pub fn getRuntimeSafety() u8 {
    return if (builtin.mode == .ReleaseSafe or builtin.mode == .Debug) 1 else 0;
}
