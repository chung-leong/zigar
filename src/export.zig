const std = @import("std");
const builtin = @import("builtin");
const slot = @import("slot");
const host = @import("host");
const t = @import("type");

pub const api_version = 1;

const Value = host.Value;
const Host = host.Host;
const StructureType = host.StructureType;
const MemberType = host.MemberType;

fn getStructureMembers(comptime T: type) []const Member {
    const count = switch (@typeInfo(T)) {
        .Struct, .Union => |st| st.fields.len,
        else => 1,
    };
    var members: [count]Member = undefined;
    switch (@typeInfo(BT)) {
        .Bool, .Int, .Float, .Void => {
            members[0] = .{
                .member_type = t.getMemberType(T),
                .bits = @bitSizeOf(T),
                .bit_offset = 0,
                .bytes = @sizeOf(T),
                .signed = isSigned(T),
            };
        },
        .Array => {},
        .Struct, .Union => |st| {},
        .Enum => |en| {},
    }
    return members;
}

fn getStructure(h: Host, comptime T: type) !Value {
    const slot_id = h.getConstructId(.{ .Struct = T });
    return h.getSlot(slot_id) catch undefined: {
        const s_type = getStructureType(T);
        const name = @typeName(T);
        // create the structure and place it in the slot immediately
        // so that recursive definition work correctly
        const structure = h.createStructure(s_type, name);
        h.setSlot(slot_id, structure);
        // define the shape of the structure
        switch (s_type) {
            .Normal, .Union => {
                for (std.meta.fields(T)) |field| {
                    const FT = field.type;
                    try h.attachMember(.{
                        .type = getMemberType(FT),
                        .bits = @bitSizeOf(FT),
                        .bit_offset = @bitOffsetOf(FT, field.name),
                        .signed = isSigned(FT),
                        .class_id = id: {
                            if (getStructureType(FT) == .Singleton) {
                                break :id 0;
                            } else {
                                break :id getStructure(h, FT);
                            }
                        },
                    });
                }
            },
            .Pointer => {
                // TODO
            },
            .Array => {
                const info = @typeInfo(T).Array;
                const CT = info.child;
                try h.attachMember(.{
                    .type = getMemberType(CT),
                    .bits = @bitSizeOf(CT),
                    .bit_offset = 0,
                    .signed = isSigned(CT),
                    .len = info.len,
                });
            },
            .Singleton => {
                try h.attachMember(.{
                    .type = getMemberType(T),
                    .bits = @bitSizeOf(T),
                    .bit_offset = 0,
                    .signed = isSigned(T),
                });
            },
        }

        break :undefined structure;
    };
}

fn StaticStruct(comptime T: type) ?type {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        else => return null,
    };
    const fields: std.builtin.Type.StructField[decls.len] = undefined;
    var count = 0;
    for (decls) |decl| {
        if (!decl.is_pub) {
            continue;
        }
        switch (@typeInfo(@field(T, decl.name))) {
            .Fn, .Frame, .AnyFrame, .NoReturn => continue,
            else => {},
        }
        const PT = @TypeOf(&@field(T, decl.name));
        fields[count] = .{
            .name = decl.name,
            .type = PT,
            .default_value = &@field(T, decl.name),
            .is_comptime = false,
            .alignment = @alignOf(PT),
        };
        count += 1;
    }
    if (count == 0) {
        return null;
    }
    return @Type(.{ .Struct = .{
        .layout = .Auto,
        .decls = .{},
        .fields = fields[0..count],
        .is_tuple = false,
    } });
}

fn ArgumentStruct(comptime function: anytype) type {
    const info = @typeInfo(@TypeOf(function)).Fn;
    const fields: std.builtin.Type.StructField[info.params.len + 3] = undefined;
    var count = 0;
    for (info.params, 0..) |param, i| {
        const num = std.fmt.comptimePrint("{d}", i);
        fields[count] = .{
            .name = num,
            .type = param.type orelse void,
            .is_comptime = false,
            .alignment = @alignOf(param.type),
        };
        count += 1;
    }
}

fn setReturnValue(comptime arg_struct: anytype, comptime result: anytype) void {
    if (@hasField(arg_struct, "error_name")) |value| {
        setReturnValue(arg_struct, value);
    } else |err| {
        arg_struct.error_name = @errorName(err);
    }
    if (@hasField(arg_struct, "no_retval")) {
        if (result) |value| {
            setReturnValue(arg_struct, value);
        } else {
            arg_struct.retval_null = true;
        }
    } else {
        arg_struct.retval = result;
    }
}

const invalidAddress = if (@bitSizeOf(*u8) == 64) 0xaaaa_aaaa_aaaa_aaaa else 0xaaaa_aaaa;

fn invalidPointer(PT: type) PT {
    return @intToPtr(PT, invalidAddress);
}

fn repointStructure(h: Host, obj: Value, T: type) !*T {
    const ptr = try h.getPointer(obj, *T);
    switch (@typeInfo(T)) {
        .Struct => |st| {
            inline for (st.fields, 0..) |field, index| {
                if (getMemberType(field.type) == .Pointer) {
                    if (@field(ptr, field.name) != invalidPointer(field.type)) {
                        // structure has been repointed already
                        break;
                    }
                    const reloc_id = try h.getRelocatableId(T, index);
                    const reloc = try h.getRelocatable(obj, reloc_id);
                    @field(ptr, field.name) = h.getPointer(obj, T);
                    repointStructure(h, reloc, field.type);
                }
            }
        },
    }
    return ptr;
}

fn depointStructure(h: Host, obj: Value, T: type) void {
    _ = h;
    _ = T;
    _ = obj;
}

const Thunk = fn (h: Host, arg_obj: Value) callconv(.C) void;

fn createThunk(comptime S: type, comptime name: []const u8) Thunk {
    const function = @field(S, name);
    const ArgT = ArgumentStruct(function);
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const ThunkType = struct {
        fn tryInvokingFunction(h: Host, arg_obj: Value) !void {
            var arg_struct = try repointStructure(h, arg_obj, ArgT);
            var args: Args = undefined;
            const fields = @typeInfo(Args).Struct.fields;
            inline for (fields, 0..) |_, i| {
                const num = std.fmt.comptimePrint("{d}", i);
                args[i] = @field(arg_struct, num);
            }
            var result = @call(std.builtin.CallModifier.auto, function, args);
            setReturnValue(arg_struct, result);
            try depointStructure(h, arg_obj, ArgT);
        }

        fn invokeFunction(h: Host, arg_obj: Value) callconv(.C) void {
            tryInvokingFunction(h, arg_obj) catch {};
        }
    };
    return ThunkType.invokeFunction;
}

//-----------------------------------------------------------------------------
//  Module functions
//-----------------------------------------------------------------------------

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
