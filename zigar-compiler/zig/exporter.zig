const std = @import("std");
const builtin = @import("builtin");
const types = @import("./types.zig");
const thunk_zig = @import("./thunk-zig.zig");
const thunk_js = @import("./thunk-js.zig");
const expect = std.testing.expect;

const Value = types.Value;
const Memory = types.Memory;
const TypeData = types.TypeData;

// NOTE: error type has to be specified here since the function is called recursively
// and https://github.com/ziglang/zig/issues/2971 has not been fully resolved yet
fn getStructure(ctx: anytype, comptime T: type) types.Error!Value {
    const td = ctx.tdb.get(T);
    const slot = td.getSlot();
    return ctx.host.readSlot(null, slot) catch create: {
        const def: types.Structure = .{
            .name = td.getName(),
            .structure_type = td.getStructureType(),
            .length = td.getLength(),
            .byte_size = td.getByteSize(),
            .alignment = td.getAlignment(),
            .is_const = td.isConst(),
            .is_tuple = td.isTuple(),
            .is_iterator = td.isIterator(),
            .has_pointer = td.hasPointer(),
        };
        // create the structure and place it in the slot immediately
        // so that recursive definition works correctly
        const structure = try ctx.host.beginStructure(def);
        try ctx.host.writeSlot(null, slot, structure);
        // define the shape of the structure
        try addMembers(ctx, structure, td);
        // finalize the shape so that static members can be instances of the structure
        try ctx.host.finalizeShape(structure);
        try addStaticMembers(ctx, structure, td);
        try ctx.host.endStructure(structure);
        break :create structure;
    };
}

fn addMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    switch (comptime td.getStructureType()) {
        .primitive,
        .error_set,
        .@"enum",
        => try addPrimitiveMember(ctx, structure, td),
        .@"struct",
        .extern_struct,
        .packed_struct,
        .arg_struct,
        .variadic_struct,
        => try addStructMembers(ctx, structure, td),
        .extern_union,
        .bare_union,
        .tagged_union,
        => try addUnionMembers(ctx, structure, td),
        .single_pointer,
        .multi_pointer,
        .slice_pointer,
        .c_pointer,
        => try addPointerMember(ctx, structure, td),
        .array => try addArrayMember(ctx, structure, td),
        .slice => try addSliceMember(ctx, structure, td),
        .error_union => try addErrorUnionMembers(ctx, structure, td),
        .optional => try addOptionalMembers(ctx, structure, td),
        .vector => try addVectorMember(ctx, structure, td),
        .function => try addFunctionMember(ctx, structure, td),
        else => {},
    }
}

fn addPrimitiveMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const member_type = td.getMemberType(false);
    const slot: ?usize = switch (member_type) {
        .@"comptime", .literal, .type => 0,
        else => null,
    };
    try ctx.host.attachMember(structure, .{
        .member_type = member_type,
        .bit_size = td.getBitSize(),
        .bit_offset = 0,
        .byte_size = td.getByteSize(),
        .slot = slot,
        .structure = try getStructure(ctx, td.Type),
    }, false);
}

fn addArrayMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.get(td.getElementType());
    try ctx.host.attachMember(structure, .{
        .member_type = child_td.getMemberType(false),
        .bit_size = child_td.getBitSize(),
        .byte_size = child_td.getByteSize(),
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
}

fn addSliceMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.get(td.getElementType());
    try ctx.host.attachMember(structure, .{
        .member_type = child_td.getMemberType(false),
        .bit_size = child_td.getBitSize(),
        .byte_size = child_td.getByteSize(),
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
    if (td.getSentinel()) |sentinel| {
        try ctx.host.attachMember(structure, .{
            .name = "sentinel",
            .is_required = sentinel.is_required,
            .member_type = child_td.getMemberType(false),
            .bit_offset = 0,
            .bit_size = child_td.getBitSize(),
            .byte_size = child_td.getByteSize(),
            .structure = try getStructure(ctx, child_td.Type),
        }, false);
        const memory = Memory.from(&sentinel.value, true);
        const dv = try ctx.host.captureView(memory);
        const template = try ctx.host.createTemplate(dv);
        try ctx.host.attachTemplate(structure, template, false);
    }
}

fn addVectorMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.get(td.getElementType());
    const child_byte_size = if (td.isBitVector()) null else child_td.getByteSize();
    try ctx.host.attachMember(structure, .{
        .member_type = child_td.getMemberType(false),
        .bit_size = child_td.getBitSize(),
        .byte_size = child_byte_size,
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
}

fn addPointerMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const TT = td.getTargetType();
    try ctx.host.attachMember(structure, .{
        .member_type = td.getMemberType(false),
        .bit_size = td.getBitSize(),
        .byte_size = td.getByteSize(),
        .slot = 0,
        .structure = try getStructure(ctx, TT),
    }, false);
}

fn addStructMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const st = @typeInfo(td.Type).Struct;
    inline for (st.fields, 0..) |field, index| {
        const field_td = ctx.tdb.get(field.type);
        // comptime fields are not actually stored in the struct
        // fields of comptime types in comptime structs are handled in the same manner
        const is_actual = !field.is_comptime and !field_td.isComptimeOnly();
        const supported = comptime field_td.isSupported();
        try ctx.host.attachMember(structure, .{
            .name = field.name,
            .member_type = field_td.getMemberType(field.is_comptime),
            .is_required = field.default_value == null,
            .bit_offset = if (is_actual) @bitOffsetOf(td.Type, field.name) else null,
            .bit_size = if (is_actual) field_td.getBitSize() else null,
            .byte_size = if (is_actual and !td.isPacked()) field_td.getByteSize() else null,
            .slot = index,
            .structure = if (supported) try getStructure(ctx, field.type) else null,
        }, false);
    }
    if (st.backing_integer) |IT| {
        // add member for backing int
        const int_td = ctx.tdb.get(IT);
        try ctx.host.attachMember(structure, .{
            .member_type = int_td.getMemberType(false),
            .bit_offset = 0,
            .bit_size = int_td.getBitSize(),
            .byte_size = int_td.getByteSize(),
            .structure = try getStructure(ctx, IT),
        }, false);
    }
    if (!td.isArguments()) {
        // add default values
        var template_maybe: ?Value = null;
        // strip out comptime content (e.g ?type -> ?void)
        const CFT = ComptimeFree(td.Type);
        if (@sizeOf(CFT) > 0) {
            var values: CFT = undefined;
            // obtain byte array containing data of default values
            // can't use std.mem.zeroInit() here, since it'd fail with unions
            const bytes: []u8 = std.mem.asBytes(&values);
            for (bytes) |*byte_ptr| {
                byte_ptr.* = 0;
            }
            inline for (st.fields) |field| {
                if (field.default_value) |opaque_ptr| {
                    const FT = @TypeOf(@field(values, field.name));
                    if (@sizeOf(FT) != 0) {
                        const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                        if (FT == field.type) {
                            @field(values, field.name) = default_value_ptr.*;
                        } else {
                            // need cast here, as destination field is a different type with matching layout
                            // (e.g. ?type has just the present flag and so does a ?void)
                            const dest_ptr: *field.type = @ptrCast(&@field(values, field.name));
                            dest_ptr.* = default_value_ptr.*;
                        }
                    }
                }
            }
            const memory = Memory.from(&values, true);
            const dv = try ctx.host.captureView(memory);
            template_maybe = try ctx.host.createTemplate(dv);
        }
        inline for (st.fields, 0..) |field, index| {
            if (field.default_value) |opaque_ptr| {
                const field_td = ctx.tdb.get(field.type);
                const comptime_only = field.is_comptime or field_td.isComptimeOnly();
                if (comptime_only and comptime field_td.isSupported()) {
                    // comptime members aren't stored in the struct's memory
                    // they're separate objects in the slots of the struct template
                    const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                    const value_obj = try exportPointerTarget(ctx, default_value_ptr, true);
                    template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                    try ctx.host.writeSlot(template_maybe.?, index, value_obj);
                }
            }
        }
        if (template_maybe) |template| {
            try ctx.host.attachTemplate(structure, template, false);
        }
    }
}

fn addUnionMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const fields = @typeInfo(td.Type).Union.fields;
    inline for (fields, 0..) |field, index| {
        const field_td = ctx.tdb.get(field.type);
        const supported = comptime field_td.isSupported();
        try ctx.host.attachMember(structure, .{
            .name = field.name,
            .member_type = field_td.getMemberType(false),
            .bit_offset = td.getContentBitOffset(),
            .bit_size = field_td.getBitSize(),
            .byte_size = field_td.getByteSize(),
            .slot = index,
            .structure = if (supported) try getStructure(ctx, field_td.Type) else null,
        }, false);
    }
    if (td.getSelectorType()) |TT| {
        const selector_td = ctx.tdb.get(TT);
        try ctx.host.attachMember(structure, .{
            .name = "selector",
            .member_type = selector_td.getMemberType(false),
            .bit_offset = td.getSelectorBitOffset(),
            .bit_size = selector_td.getBitSize(),
            .byte_size = selector_td.getByteSize(),
            .structure = try getStructure(ctx, selector_td.Type),
        }, false);
    }
}

fn addOptionalMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    // value always comes first
    const child_td = ctx.tdb.get(@typeInfo(td.Type).Optional.child);
    try ctx.host.attachMember(structure, .{
        .name = "value",
        .member_type = child_td.getMemberType(false),
        .bit_offset = 0,
        .bit_size = child_td.getBitSize(),
        .byte_size = child_td.getByteSize(),
        .slot = 0,
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
    const ST = td.getSelectorType().?;
    const selector_td = ctx.tdb.get(ST);
    try ctx.host.attachMember(structure, .{
        .name = "present",
        .member_type = selector_td.getMemberType(false),
        .bit_offset = td.getSelectorBitOffset(),
        .bit_size = selector_td.getBitSize(),
        .byte_size = selector_td.getByteSize(),
        .structure = try getStructure(ctx, selector_td.Type),
    }, false);
}

fn addErrorUnionMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const payload_td = ctx.tdb.get(@typeInfo(td.Type).ErrorUnion.payload);
    try ctx.host.attachMember(structure, .{
        .name = "value",
        .member_type = payload_td.getMemberType(false),
        .bit_offset = td.getContentBitOffset(),
        .bit_size = payload_td.getBitSize(),
        .byte_size = payload_td.getByteSize(),
        .slot = 0,
        .structure = try getStructure(ctx, payload_td.Type),
    }, false);
    const error_td = ctx.tdb.get(@typeInfo(td.Type).ErrorUnion.error_set);
    try ctx.host.attachMember(structure, .{
        .name = "error",
        .member_type = error_td.getMemberType(false),
        .bit_offset = td.getErrorBitOffset(),
        .bit_size = error_td.getBitSize(),
        .byte_size = error_td.getByteSize(),
        .structure = try getStructure(ctx, error_td.Type),
    }, false);
}

fn addFunctionMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const FT = types.Uninlined(td.Type);
    const arg_td = ctx.tdb.get(types.ArgumentStruct(FT));
    try ctx.host.attachMember(structure, .{
        .name = "args",
        .member_type = arg_td.getMemberType(false),
        .bit_size = arg_td.getBitSize(),
        .byte_size = arg_td.getByteSize(),
        .structure = try getStructure(ctx, arg_td.Type),
    }, false);
    // store thunk as instance template
    const thunk = thunk_zig.createThunk(@TypeOf(ctx.host), FT);
    const thunk_memory = Memory.from(thunk, false);
    const thunk_dv = try ctx.host.captureView(thunk_memory);
    const instance_template = try ctx.host.createTemplate(thunk_dv);
    try ctx.host.attachTemplate(structure, instance_template, false);
    const ptr_tdb = ctx.tdb.get(*const FT);
    if (comptime ptr_tdb.isInUse()) {
        // store JS thunk as static template
        const js_thunk_constructor = thunk_js.createThunkConstructor(@TypeOf(ctx.host), FT, td.getSlot());
        const js_thunk_constructor_memory = Memory.from(js_thunk_constructor, false);
        const js_thunk_constructor_dv = try ctx.host.captureView(js_thunk_constructor_memory);
        const static_template = try ctx.host.createTemplate(js_thunk_constructor_dv);
        try ctx.host.attachTemplate(structure, static_template, true);
    }
}

fn addStaticMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    var template_maybe: ?Value = null;
    // add declared static members
    comptime var offset = 0;
    switch (@typeInfo(td.Type)) {
        inline .Struct, .Union, .Enum, .Opaque => |st| {
            inline for (st.decls, 0..) |decl, index| {
                const decl_ptr = &@field(td.Type, decl.name);
                const decl_ptr_td = ctx.tdb.get(@TypeOf(decl_ptr));
                if (comptime decl_ptr_td.isSupported()) {
                    const decl_value = decl_ptr.*;
                    const DT = @TypeOf(decl_value);
                    // export type only if it's supported
                    const is_value_supported = if (DT == type)
                        ctx.tdb.get(decl_value).isSupported()
                    else
                        true;
                    if (is_value_supported) {
                        // always export constants while variables can be optionally switched off
                        if (decl_ptr_td.isConst() or !ctx.options.omit_variables) {
                            try ctx.host.attachMember(structure, .{
                                .name = decl.name,
                                .member_type = if (decl_ptr_td.isConst()) .@"comptime" else .static,
                                .slot = index,
                                .structure = try getStructure(ctx, DT),
                            }, true);
                            const is_comptime = comptime switch (@typeInfo(DT)) {
                                .Fn => false,
                                else => decl_ptr_td.isConst(),
                            };
                            // deal with inline functions
                            const target_ptr = switch (@typeInfo(DT)) {
                                .Fn => &thunk_zig.uninline(decl_value),
                                else => decl_ptr,
                            };
                            const value_obj = try exportPointerTarget(ctx, target_ptr, is_comptime);
                            template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                            try ctx.host.writeSlot(template_maybe.?, index, value_obj);
                        }
                    }
                }
                offset += 1;
            }
        },
        else => {},
    }
    // add implicit static members
    switch (@typeInfo(td.Type)) {
        .Enum => |en| {
            // add fields as static members
            inline for (en.fields, 0..) |field, index| {
                const value = @field(td.Type, field.name);
                const slot = offset + index;
                try ctx.host.attachMember(structure, .{
                    .name = field.name,
                    .member_type = .@"comptime",
                    .slot = slot,
                    .structure = structure,
                }, true);
                const value_obj = try exportPointerTarget(ctx, &value, true);
                template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                try ctx.host.writeSlot(template_maybe.?, slot, value_obj);
            }
            if (!en.is_exhaustive) {
                try ctx.host.attachMember(structure, .{
                    .member_type = .@"comptime",
                    .structure = structure,
                }, true);
            }
        },
        .ErrorSet => |es| if (es) |errors| {
            inline for (errors, 0..) |err_rec, index| {
                // get error from global set
                const err = @field(anyerror, err_rec.name);
                const slot = offset + index;
                try ctx.host.attachMember(structure, .{
                    .name = err_rec.name,
                    .member_type = .@"comptime",
                    .slot = slot,
                    .structure = structure,
                }, true);
                // can't use exportPointerTarget(), since each error in the set would be
                // considered a separate type--need special handling
                const value_obj = try exportError(ctx, err, structure);
                template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                try ctx.host.writeSlot(template_maybe.?, slot, value_obj);
            }
        },
        else => {},
    }
    if (template_maybe) |template| {
        try ctx.host.attachTemplate(structure, template, true);
    }
}

fn exportPointerTarget(ctx: anytype, comptime ptr: anytype, comptime is_comptime: bool) !Value {
    const td = ctx.tdb.get(@TypeOf(ptr.*));
    const value_ptr = get: {
        // values that only exist at comptime need to have their comptime part replaced with void
        // (comptime keyword needed here since expression evaluates to different pointer types)
        if (comptime td.isComptimeOnly()) {
            var runtime_value: ComptimeFree(td.Type) = removeComptimeValues(ptr.*);
            break :get &runtime_value;
        } else {
            break :get ptr;
        }
    };
    const memory = Memory.from(value_ptr, is_comptime);
    const structure = try getStructure(ctx, td.Type);
    const obj = try ctx.host.castView(memory, structure);
    if (comptime td.isComptimeOnly()) {
        try attachComptimeValues(ctx, obj, ptr.*);
    }
    return obj;
}

fn exportError(ctx: anytype, err: anyerror, structure: Value) !Value {
    const memory = Memory.from(&err, true);
    const obj = try ctx.host.castView(memory, structure);
    return obj;
}

fn exportComptimeValue(ctx: anytype, comptime value: anytype) !Value {
    return switch (@typeInfo(@TypeOf(value))) {
        .ComptimeInt => exportPointerTarget(ctx, &@as(types.IntType(value), value), true),
        .ComptimeFloat => exportPointerTarget(ctx, &@as(f64, value), true),
        .EnumLiteral => exportPointerTarget(ctx, @tagName(value), true),
        .Type => getStructure(ctx, value),
        else => return exportPointerTarget(ctx, &value, true),
    };
}

fn attachComptimeValues(ctx: anytype, target: Value, comptime value: anytype) !void {
    const td = ctx.tdb.get(@TypeOf(value));
    switch (@typeInfo(td.Type)) {
        .Type => {
            const obj = try getStructure(ctx, value);
            try ctx.host.writeSlot(target, 0, obj);
        },
        .ComptimeInt, .ComptimeFloat, .EnumLiteral => {
            const obj = try exportComptimeValue(ctx, value);
            try ctx.host.writeSlot(target, 0, obj);
        },
        .Array => {
            inline for (value, 0..) |element, index| {
                const obj = try exportComptimeValue(ctx, element);
                try ctx.host.writeSlot(target, index, obj);
            }
        },
        .Struct => |st| {
            inline for (st.fields, 0..) |field, index| {
                const field_td = ctx.tdb.get(field.type);
                if (field_td.isComptimeOnly()) {
                    const field_value = @field(value, field.name);
                    const obj = try exportComptimeValue(ctx, field_value);
                    try ctx.host.writeSlot(target, index, obj);
                }
            }
        },
        .Union => |un| {
            if (un.tag_type) |Tag| {
                const tag: Tag = value;
                inline for (un.fields, 0..) |field, index| {
                    if (@field(Tag, field.name) == tag) {
                        const field_td = ctx.tdb.get(field.type);
                        if (field_td.isComptimeOnly()) {
                            const field_value = @field(value, field.name);
                            const obj = try exportComptimeValue(ctx, field_value);
                            try ctx.host.writeSlot(target, index, obj);
                        }
                    }
                }
            } else {
                @compileError("Unable to handle comptime value in bare union");
            }
        },
        .Optional => {
            if (value) |v| {
                const obj = try exportComptimeValue(ctx, v);
                try ctx.host.writeSlot(target, 0, obj);
            }
        },
        .ErrorUnion => {
            if (value) |v| {
                const obj = try exportComptimeValue(ctx, v);
                try ctx.host.writeSlot(target, 0, obj);
            } else |_| {}
        },
        else => {},
    }
}

fn ComptimeFree(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .ComptimeFloat,
        .ComptimeInt,
        .EnumLiteral,
        .Type,
        .Null,
        .Undefined,
        => void,
        .Array => |ar| [ar.len]ComptimeFree(ar.child),
        .Struct => |st| derive: {
            var new_fields: [st.fields.len]std.builtin.Type.StructField = undefined;
            inline for (st.fields, 0..) |field, index| {
                const FT = if (field.is_comptime) void else ComptimeFree(field.type);
                new_fields[index] = .{
                    .name = field.name,
                    .type = FT,
                    .default_value = null,
                    .is_comptime = false,
                    .alignment = if (st.layout != .@"packed") @alignOf(FT) else 0,
                };
            }
            break :derive @Type(.{
                .Struct = .{
                    .layout = st.layout,
                    .fields = &new_fields,
                    .decls = &.{},
                    .is_tuple = st.is_tuple,
                },
            });
        },
        .Union => |un| derive: {
            var new_fields: [un.fields.len]std.builtin.Type.UnionField = undefined;
            inline for (un.fields, 0..) |field, index| {
                const FT = ComptimeFree(field.type);
                new_fields[index] = .{
                    .name = field.name,
                    .type = FT,
                    .alignment = @alignOf(FT),
                };
            }
            break :derive @Type(.{
                .Union = .{
                    .layout = un.layout,
                    .tag_type = un.tag_type,
                    .fields = &new_fields,
                    .decls = &.{},
                },
            });
        },
        .Optional => |op| ?ComptimeFree(op.child),
        .ErrorUnion => |eu| eu.error_set!ComptimeFree(eu.payload),
        else => T,
    };
}

fn removeComptimeValues(comptime value: anytype) ComptimeFree(@TypeOf(value)) {
    const T = @TypeOf(value);
    const RT = ComptimeFree(T);
    if (comptime T == RT) {
        return value;
    }
    var result: RT = undefined;
    switch (@typeInfo(T)) {
        .ComptimeFloat,
        .ComptimeInt,
        .EnumLiteral,
        .Type,
        .Null,
        .Undefined,
        => result = {},
        .Array => {
            inline for (value, 0..) |element, index| {
                result[index] = removeComptimeValues(element);
            }
        },
        .Struct => |st| {
            inline for (st.fields) |field| {
                @field(result, field.name) = removeComptimeValues(@field(value, field.name));
            }
        },
        .Union => |un| {
            if (un.tag_type) |Tag| {
                const tag: Tag = value;
                const field_name = @tagName(tag);
                const field_value = @field(value, field_name);
                result = @unionInit(RT, field_name, removeComptimeValues(field_value));
            } else {
                @compileError("Unable to handle comptime value in bare union");
            }
        },
        .Optional => result = if (value) |v| removeComptimeValues(v) else null,
        .ErrorUnion => result = if (value) |v| removeComptimeValues(v) else |e| e,
        else => result = value,
    }
    return result;
}

pub fn createRootFactory(comptime HostT: type, comptime T: type) thunk_zig.Thunk {
    @setEvalBranchQuota(2000000);
    comptime var tdc = types.TypeDataCollector.init(256);
    comptime tdc.scan(T);
    const tdb = comptime tdc.createDatabase();
    const RootFactory = struct {
        fn exportStructure(ptr: ?*anyopaque, _: *const anyopaque, arg_ptr: *anyopaque) callconv(.C) ?Value {
            @setEvalBranchQuota(2000000);
            const host = HostT.init(ptr);
            const options: *const types.HostOptions = @ptrCast(arg_ptr);
            const ctx = .{ .host = host, .options = options, .tdb = tdb };
            if (getStructure(ctx, T)) |_| {
                return null;
            } else |err| {
                return host.createMessage(err);
            }
        }
    };
    return RootFactory.exportStructure;
}
