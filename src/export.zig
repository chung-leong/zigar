const std = @import("std");
const slot = @import("slot");
const host = @import("host");

pub const api_version = 1;

const Value = host.Value;
const Host = host.Host;
const StructureType = host.StructureType;
const MemberType = host.MemberType;

fn getStructure(h: Host, comptime T: type) !Value {
    return h.getConstruct(.{ .Struct = T }) orelse new: {
        const structure = try defineStructure(host, T);
        try h.setConstruct(.{ .Struct = T }, structure);
        break :new structure;
    };
}

fn getStructureType(comptime T: type) StructureType {
    return switch (@typeInfo(T)) {
        .Struct => .Normal,
        .Union => .Union,
        .Enum => .Enumeration,
        .Array => .Array,
        .Opaque => .Opaque,
        .Bool, .Int, .Float, .Void => .Singleton,
    };
}

fn getMemberType(comptime T: type) MemberType {
    return switch (@typeInfo(T)) {
        .Bool => .Bool,
        .Int => .Int,
        .Float => .Float,
        .Struct, .Union, .Array, .Enum, .Opaque => .Structure,
        .Pointer => .Pointer,
        else => .Void,
    };
}

fn isSigned(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Int => |int| int.signedness == .signed,
        else => false,
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

fn defineStructure(h: Host, comptime T: type) !Value {
    const s_type = getStructureType(T);
    const def = try h.beginStructure(s_type);
    switch (s_type) {
        .Normal, .Union, .Enumeration, .Opaque => {},
        .Pointer => {
            // TODO
        },
        .Array => {
            const info = @typeInfo(T).Array;
            const CT = info.child;
            h.addMember(.{
                .type = getMemberType(CT),
                .bits = @bitSizeOf(CT),
                .bit_offset = 0,
                .signed = isSigned(CT),
                .len = info.len,
            });
        },
        .Singleton => {
            h.addMember(.{
                .type = getMemberType(T),
                .bits = @bitSizeOf(T),
                .bit_offset = 0,
                .signed = isSigned(T),
            });
        },
    }
    return h.finalizeStructure(def);
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

fn repointStruct(h: Host, obj: Value, T: type) *T {
    _ = obj;
    _ = h;
}

fn depointStruct(h: Host, obj: Value, T: type) void {
    _ = h;
    _ = T;
    _ = obj;
}

//-----------------------------------------------------------------------------
//  Thunk creation functions (compile-time)
//-----------------------------------------------------------------------------
fn createThunk(comptime S: type, comptime name: []const u8) Thunk {
    const function = @field(S, name);
    const ArgT = ArgumentStruct(function);
    _ = ArgT;
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    _ = Args;
    const ThunkType = struct {
        fn invokeFunction(host: Host, arg_obj: Value) callconv(.C) void {
            var arg_struct = repointStruct(host, arg_obj, ArgT);
            var args: Args = undefined;
            const fields = @typeInfo(Args).Struct.fields;
            inline for (fields, 0..) |_, i| {
                const num = std.fmt.comptimePrint("{d}", i);
                args[i] = @field(arg_struct, num);
            }
            var result = @host(std.builtin.CallModifier.auto, function, args);
            setReturnValue(arg_struct, result);
            depointStruct(host, arg_obj, ArgT);
        }
    };
    return ThunkType.invokeFunction;
}

//-----------------------------------------------------------------------------
//  Data types that appear in the exported module struct
//-----------------------------------------------------------------------------

pub fn createRootFactory(comptime S: type) host.Factory {
    _ = S;
    const RootFactory = struct {
        fn exportNamespace(h: Host, dest: *Value) callconv(.C) host.Result {
            if (getClass(h, S)) |ns| {
                dest.* = ns;
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
        .callbacks = &host.callbacks,
        .factory = createRootFactory(S),
    };
}
