const std = @import("std");
const builtin = @import("builtin");
const slot = @import("slot");
const host = @import("host");
const t = @import("type");

pub const api_version = 1;

const Value = t.Value;
const Host = host.Host;
const StructureType = t.StructureType;
const MemberType = t.MemberType;
const Member = t.Member;
const MemberSet = t.MemberSet;
const Method = t.Method;
const MethodSet = t.MethodSet;

fn getStructure(h: Host, comptime T: type) !Value {
    const slot_id = h.getConstructSlot(.{ .Struct = T });
    return h.getSlot(slot_id) catch undefined: {
        const s_type = t.getStructureType(T);
        const s_size = @sizeOf(T);
        const name = @typeName(T);
        // create the structure and place it in the slot immediately
        // so that recursive definition work correctly
        const structure = h.createStructure(s_type, name);
        h.setSlot(slot_id, structure);
        // define the shape of the structure
        const members = getMembers(h, T);
        const default_data = getDefaultData(h, T);
        const default_pointers = getDefaultPointers(h, T);
        const def: MemberSet = .{
            .members = members,
            .member_count = members.set,
            .default_data = defaultData,
            .default_pointers = pointers,
            .default_pointer_count = pointers.len,
        };
        h.shapeStructure(structure, def);
        break :undefined structure;
    };
}

fn getMembers(h: Host, comptime T: type) ![]const Member {
    const count = switch (@typeInfo(T)) {
        .Struct, .Union, .Enum => |st| st.fields.len,
        else => 1,
    };
    var members: [count]Member = undefined;
    switch (@typeInfo(T)) {
        .Bool, .Int, .Float, .Void => {
            // primitive
            members[0] = .{
                .member_type = t.getMemberType(T),
                .signed = t.isSigned(T),
                .bit_size = @bitSizeOf(T),
                .bit_offset = 0,
                .byte_size = @sizeOf(T),
            };
        },
        .Array => |ar| {
            members[0] = .{
                .member_type = t.getMemberType(ar.child),
                .signed = t.isSigned(ar.child),
                .bit_size = @bitSizeOf(ar.child),
                .bit_offset = 0,
                .byte_size = @sizeOf(ar.child),
            };
        },
        .Struct, .Union => |st| {
            // pre-allocate relocatable slots for fields that always need them
            inline for (st.fields) |field| {
                switch (t.getMemberType(field.type)) {
                    .Pointer, .Compound, .Enum => {
                        _ = h.getRelocatableSlot(T, field.name);
                    },
                    else => {},
                }
            }
            inline for (st.fields, 0..) |field, index| {
                members[index] = .{
                    .name = field.name,
                    .member_type = t.getMemberType(field.type),
                    .signed = t.isSigned(field.type),
                    .bit_offset = @bitOffsetOf(T, field.name),
                    .bit_size = @bitSizeOf(field.type),
                    .byte_size = if (st.layout != .Packed) @sizeOf(field.type) else 0,
                    .structure = try getStructure(h, field.type),
                    .slot = h.getRelocatableSlot(T, field.name),
                };
            }
        },
        .Enum => |en| {
            // find a type that fit all values
            const IT = t.getEnumType(T);
            inline for (en.fields, 0..) |field, index| {
                members[index] = .{
                    .name = field.name,
                    .member_type = t.getMemberType(IT),
                    .signed = t.isSigned(IT),
                    .bit_offset = 0,
                    .bit_size = @bitSizeOf(IT),
                    .byte_size = @sizeOf(IT),
                };
            }
        },
    }
    return members;
}

fn getVariables(h: Host, comptime T: type) !?[]const Member {
    if (StaticStruct(T)) |SS| {
        return try getMembers(h, SS);
    }
}

fn getMethods(h: Host, comptime T: type) !?[]const Method {
    const decls = switch (@typeInfo(T)) {
        .Struct, .Union, .Enum, .Opaque => |st| st.decls,
        else => return null,
    };
    var methods: [decls.len]Method = undefined;
    var count = 0;
    inline for (decls) |decl| {
        if (!decl.is_pub) {
            continue;
        }
        switch (@typeInfo(@field(T, decl.name))) {
            .Fn => {
                const function = @field(T, decl.name);
                const ArgT = ArgumentStruct(function);
                const arg_structure = try getStructure(h, ArgT);
                methods[count] = .{
                    .name = decl.name,
                    .is_static_only = true,
                    .thunk = createThunk(function, ArgT),
                    .structure = arg_structure,
                };
                count += 1;
            },
            else => {},
        }
    }
    return methods[0..count];
}

fn StaticStruct(comptime T: type) ?type {
    const decls = switch (@typeInfo(T)) {
        .Struct, .Union, .Enum, .Opaque => |st| st.decls,
        else => return null,
    };
    // create static struct
    var fields: std.builtin.Type.StructField[decls.len] = undefined;
    var count = 0;
    inline for (decls) |decl| {
        if (!decl.is_pub) {
            continue;
        }
        switch (@typeInfo(@field(T, decl.name))) {
            .Fn, .Frame, .AnyFrame, .NoReturn => {},
            else => {
                const PT = @TypeOf(&@field(T, decl.name));
                fields[count] = .{
                    .name = decl.name,
                    .type = PT,
                    .default_value = &@field(T, decl.name),
                    .is_comptime = false,
                    .alignment = @alignOf(PT),
                };
                count += 1;
            },
        }
    }
    if (count == 0) {
        return null;
    }
    return @Type(.{
        .Struct = .{
            .layout = .Auto,
            .decls = .{},
            .fields = fields[0..count],
            .is_tuple = false,
        },
    });
}

fn ArgumentStruct(comptime function: anytype) type {
    const info = @typeInfo(@TypeOf(function)).Fn;
    const len = info.params.len + 1;
    const fields: std.builtin.Type.StructField[len] = undefined;
    for (info.params, 0..) |param, index| {
        const name = std.fmt.comptimePrint("{d}", index);
        fields[index] = .{
            .name = name,
            .type = param.type orelse void,
            .is_comptime = false,
            .alignment = @alignOf(param.type),
        };
    }
    fields[len - 1] = .{
        .name = "retval",
        .type = info.return_type,
        .is_comptime = false,
        .alignment = @alignOf(info.return_type),
    };
    return @Type(.{
        .Struct = .{
            .layout = .Auto,
            .decls = .{},
            .fields = fields[0..len],
            .is_tuple = false,
        },
    });
}

const invalid_address = if (@bitSizeOf(*u8) == 64) 0xaaaa_aaaa_aaaa_aaaa else 0xaaaa_aaaa;

fn invalidPointer(PT: type) PT {
    return @intToPtr(PT, invalid_address);
}

fn repointStructure(h: Host, obj: Value, T: type) !*T {
    _ = obj;
    _ = h;
}

fn depointStructure(h: Host, obj: Value, T: type) void {
    _ = T;
    _ = obj;
    _ = h;
}

const Thunk = fn (h: Host, arg_obj: Value) callconv(.C) void;

fn createThunk(comptime function: anytype, comptime ArgT: type) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const S = struct {
        fn tryInvokingFunction(h: Host, arg_obj: Value) !void {
            var arg_struct = try repointStructure(h, arg_obj, ArgT);
            var args: Args = undefined;
            const fields = @typeInfo(Args).Struct.fields;
            inline for (fields, 0..) |_, i| {
                const name = std.fmt.comptimePrint("{d}", i);
                args[i] = @field(arg_struct, name);
            }
            arg_struct.retval = @call(std.builtin.CallModifier.auto, function, args);
            try depointStructure(h, arg_obj, ArgT);
        }

        fn invokeFunction(h: Host, arg_obj: Value) callconv(.C) void {
            tryInvokingFunction(h, arg_obj) catch {};
        }
    };
    return S.invokeFunction;
}

pub fn createRootFactory(comptime S: type) host.Factory {
    const RootFactory = struct {
        fn exportNamespace(h: Host, dest: *Value) callconv(.C) host.Result {
            if (getStructure(h, S)) |s| {
                dest.* = s;
                return .OK;
            } else |_| {
                return .Failure;
            }
        }
    };
    return RootFactory.exportNamespace;
}

pub fn createModule(comptime S: type) host.Module {
    return .{
        .version = api_version,
        .flags = .{
            .little_endian = builtin.target.cpu.arch.endian() == .Little,
            .runtime_safety = switch (builtin.mode) {
                .Debug, .ReleaseSafe => true,
                else => false,
            },
        },
        .callbacks = &host.callbacks,
        .factory = createRootFactory(S),
    };
}
