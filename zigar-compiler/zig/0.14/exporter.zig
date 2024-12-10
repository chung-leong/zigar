const std = @import("std");
const builtin = @import("builtin");
const types = @import("types.zig");
const fn_transform = @import("fn-transform.zig");
const thunk_zig = @import("thunk-zig.zig");
const thunk_js = @import("thunk-js.zig");
const expect = std.testing.expect;

const Value = types.Value;
const Memory = types.Memory;
const TypeData = types.TypeData;

fn Factory(comptime host: type, comptime module: type) type {
    @setEvalBranchQuota(2000000);
    const tdb = comptime result: {
        var tdc = types.TypeDataCollector.init(256);
        tdc.add(*const fn (*const anyopaque, *anyopaque) anyerror!void);
        tdc.add(*const fn (*const anyopaque, *anyopaque, *const anyopaque, usize) anyerror!void);
        tdc.add(*const fn (?*anyopaque, thunk_js.ActionType, usize) anyerror!usize);
        tdc.add(*const anyopaque);
        tdc.scan(module);
        break :result tdc.createDatabase();
    };
    return struct {
        options: types.ExportOptions,

        pub fn getStructureType(comptime td: TypeData) types.StructureType {
            return if (td.attrs.is_arguments)
                switch (td.attrs.is_variadic) {
                    false => .arg_struct,
                    true => .variadic_struct,
                }
            else if (td.attrs.is_slice)
                .slice
            else switch (@typeInfo(td.type)) {
                .bool,
                .int,
                .comptime_int,
                .float,
                .comptime_float,
                .null,
                .undefined,
                .void,
                .type,
                .enum_literal,
                => .primitive,
                .@"struct" => .@"struct",
                .@"union" => .@"union",
                .error_union => .error_union,
                .error_set => .error_set,
                .optional => .optional,
                .@"enum" => .@"enum",
                .array => .array,
                .pointer => .pointer,
                .vector => .vector,
                .@"opaque" => .@"opaque",
                .@"fn" => .function,
                else => @compileError("Unsupported type: " ++ @typeName(td.type)),
            };
        }

        pub fn getStructureFlags(comptime td: TypeData) types.StructureFlags {
            return switch (@typeInfo(td.type)) {
                .bool,
                .int,
                .comptime_int,
                .float,
                .comptime_float,
                .null,
                .undefined,
                .void,
                .type,
                .enum_literal,
                => .{
                    .primitive = .{
                        .has_slot = td.isComptimeOnly(),
                        .is_size = td.type == usize or td.type == isize,
                    },
                },
                .@"struct" => |st| get: {
                    const has_object = inline for (st.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject()) break true;
                    } else false;
                    const has_slot = inline for (st.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject() or field_td.isComptimeOnly() or field.is_comptime) break true;
                    } else false;
                    break :get if (comptime td.isArguments()) .{
                        .arg_struct = .{
                            .has_object = has_object,
                            .has_slot = has_slot,
                            .has_pointer = td.hasPointer(),
                            .has_options = inline for (st.fields) |field| {
                                const field_td = tdb.get(field.type);
                                if (field_td.isOptional()) {
                                    break true;
                                }
                            } else false,
                            .is_throwing = @typeInfo(st.fields[0].type) == .error_union,
                            .is_async = inline for (st.fields) |field| {
                                const field_td = tdb.get(field.type);
                                if (field_td.isPromise()) {
                                    break true;
                                }
                            } else false,
                        },
                    } else if (comptime td.isSlice()) .{
                        .slice = .{
                            .has_object = has_object,
                            .has_slot = has_slot,
                            .has_pointer = td.hasPointer(),
                            .has_sentinel = td.type.sentinel != null,
                            .is_string = td.getElementType() == u8 or td.getElementType() == u16,
                            .is_typed_array = isTypedArray(td),
                            .is_clamped_array = td.getElementType() == u8 and isTypedArray(td),
                            .is_opaque = td.type.is_opaque,
                        },
                    } else .{
                        .@"struct" = .{
                            .has_object = has_object,
                            .has_slot = has_slot,
                            .has_pointer = td.hasPointer(),
                            .is_extern = st.layout == .@"extern",
                            .is_packed = st.layout == .@"packed",
                            .is_tuple = st.is_tuple,
                            .is_iterator = td.isIterator(),
                            .is_allocator = td.isAllocator(),
                            .is_promise = td.isPromise(),
                            .is_abort_signal = td.isAbortSignal(),
                        },
                    };
                },
                .@"union" => |un| get: {
                    const has_object = inline for (un.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject()) break true;
                    } else false;
                    const has_slot = inline for (un.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject() or field_td.isComptimeOnly()) break true;
                    } else false;
                    break :get .{
                        .@"union" = .{
                            .has_object = has_object,
                            .has_slot = has_slot,
                            .has_pointer = td.hasPointer(),
                            .has_tag = un.tag_type != null,
                            .has_inaccessible = un.tag_type == null and td.hasPointer(),
                            .has_selector = td.hasSelector(),
                            .is_extern = un.layout == .@"extern",
                            .is_packed = un.layout == .@"packed",
                            .is_iterator = td.isIterator(),
                        },
                    };
                },
                .error_union => |eu| get: {
                    const payload_td = tdb.get(eu.payload);
                    break :get .{
                        .error_union = .{
                            .has_object = payload_td.isObject(),
                            .has_slot = payload_td.isObject() or payload_td.isComptimeOnly(),
                            .has_pointer = td.hasPointer(),
                        },
                    };
                },
                .optional => |op| get: {
                    const child_td = tdb.get(op.child);
                    break :get .{
                        .optional = .{
                            .has_object = child_td.isObject(),
                            .has_slot = child_td.isObject() or child_td.isComptimeOnly(),
                            .has_pointer = td.hasPointer(),
                            .has_selector = td.hasSelector(),
                        },
                    };
                },
                .@"enum" => |en| .{
                    .@"enum" = .{
                        .is_open_ended = !en.is_exhaustive,
                        .is_iterator = td.isIterator(),
                    },
                },
                .error_set => .{
                    .error_set = .{
                        .is_global = td.type == anyerror,
                    },
                },
                .array => |ar| get: {
                    const child_td = tdb.get(ar.child);
                    break :get .{
                        .array = .{
                            .has_object = child_td.isObject(),
                            .has_slot = child_td.isObject() or child_td.isComptimeOnly(),
                            .has_pointer = td.attrs.has_pointer,
                            .has_sentinel = td.getSentinel() != null,
                            .is_string = td.getElementType() == u8 or td.getElementType() == u16,
                            .is_typed_array = isTypedArray(td),
                            .is_clamped_array = td.getElementType() == u8 and isTypedArray(td),
                        },
                    };
                },
                .vector => .{
                    .vector = .{
                        .is_typed_array = isTypedArray(td),
                    },
                },
                .pointer => |pt| .{
                    .pointer = .{
                        .has_length = pt.size == .Slice,
                        .is_const = pt.is_const,
                        .is_single = pt.size == .One or pt.size == .C,
                        .is_multiple = pt.size != .One,
                        .is_nullable = pt.is_allowzero or pt.child == anyopaque,
                    },
                },
                .@"opaque" => .{
                    .@"opaque" = .{
                        .is_iterator = td.isIterator(),
                    },
                },
                .@"fn" => .{ .function = .{} },
                else => @compileError("Unknown structure: " ++ @typeName(td.type)),
            };
        }

        pub fn getStructureLength(comptime td: TypeData) ?usize {
            return switch (@typeInfo(td.type)) {
                .array => |ar| ar.len,
                .vector => |ve| ve.len,
                .@"struct" => |st| switch (td.isArguments()) {
                    true => comptime req_arg_count: {
                        var len = 0;
                        for (st.fields, 0..) |field, index| {
                            if (index == 0 or tdb.get(field.type).isOptional()) {
                                len += 0;
                            } else {
                                len += 1;
                            }
                        }
                        break :req_arg_count len;
                    },
                    false => switch (st.is_tuple) {
                        true => st.fields.len,
                        false => null,
                    },
                },
                .@"fn" => getStructureLength(tdb.get(types.ArgumentStruct(td.type))),
                else => null,
            };
        }

        pub fn getStructureName(comptime td: TypeData) ?[]const u8 {
            return switch (@typeInfo(td.type)) {
                // names of these can be inferred on the JS side
                .bool,
                .int,
                .comptime_int,
                .float,
                .comptime_float,
                .void,
                .type,
                .error_union,
                .optional,
                .array,
                .pointer,
                .vector,
                .@"fn",
                .null,
                .undefined,
                .enum_literal,
                .noreturn,
                => null,
                // return the name without ns qualifier if it's alphanumeric
                .@"struct", .@"union", .@"enum" => comptime result: {
                    var name: []const u8 = @typeName(td.type);
                    if (std.mem.lastIndexOfScalar(u8, name, '.')) |index| {
                        name = name[index + 1 .. name.len];
                    }
                    if (td.type == module) {
                        break :result name;
                    }
                    return for (name) |c| {
                        if (!std.ascii.isAlphanumeric(c)) {
                            break :result null;
                        }
                    } else name;
                },
                .error_set => switch (td.type) {
                    anyerror => "anyerror",
                    else => null,
                },
                .@"opaque" => switch (td.type) {
                    anyopaque => "anyopaque",
                    else => null,
                },
                else => null,
            };
        }

        pub fn getMemberType(comptime td: TypeData, comptime is_comptime: bool) types.MemberType {
            return switch (td.isSupported()) {
                false => .unsupported,
                true => switch (is_comptime) {
                    true => .object,
                    false => switch (@typeInfo(td.type)) {
                        .bool => .bool,
                        .int => |int| if (int.signedness == .signed) .int else .uint,
                        .float => .float,
                        .@"enum" => |en| if (@typeInfo(en.tag_type).int.signedness == .signed) .int else .uint,
                        .error_set => .uint,
                        .@"struct",
                        .@"union",
                        .array,
                        .error_union,
                        .optional,
                        .pointer,
                        .vector,
                        .@"fn",
                        .comptime_int,
                        .comptime_float,
                        => .object,
                        .type => .type,
                        .enum_literal => .literal,
                        .void => .void,
                        .null => .null,
                        else => .undefined,
                    },
                },
            };
        }

        fn isTypedArray(comptime td: TypeData) bool {
            return switch (@typeInfo(td.type)) {
                .int => |int| inline for (.{ 8, 16, 32, 64 }) |bits| {
                    if (int.bits == bits) break true;
                } else false,
                .float => |float| inline for (.{ 32, 64 }) |bits| {
                    if (float.bits == bits) break true;
                } else false,
                .array => |ar| isTypedArray(tdb.get(ar.child)),
                .vector => |ve| isTypedArray(tdb.get(ve.child)),
                .@"struct" => switch (comptime td.isSlice()) {
                    true => isTypedArray(tdb.get(td.type.ElementType)),
                    false => false,
                },
                else => false,
            };
        }

        // NOTE: error type has to be specified here since the function is called recursively
        // and https://github.com/ziglang/zig/issues/2971 has not been fully resolved yet
        fn getStructure(self: @This(), comptime T: type) types.Error!Value {
            const td = tdb.get(T);
            const slot = td.getSlot();
            return host.readSlot(null, slot) catch result: {
                const def: types.Structure = .{
                    .name = comptime getStructureName(td),
                    .type = getStructureType(td),
                    .flags = getStructureFlags(td),
                    .length = getStructureLength(td),
                    .byte_size = td.getByteSize(),
                    .alignment = td.getAlignment(),
                };
                // create the structure and place it in the slot immediately
                // so that recursive definition works correctly
                const structure = try host.beginStructure(def);
                try host.writeSlot(null, slot, structure);
                // define the shape of the structure
                try self.addMembers(structure, td);
                // finalize the shape so that static members can be instances of the structure
                _ = try host.defineStructure(structure);
                // don't export decls of internal structs like promise and abort signal
                if (comptime !td.isInternal()) {
                    try self.addStaticMembers(structure, td);
                }
                try host.endStructure(structure);
                break :result structure;
            };
        }

        fn addMembers(self: @This(), structure: Value, comptime td: TypeData) !void {
            switch (comptime getStructureType(td)) {
                .primitive,
                .error_set,
                .@"enum",
                => try self.addPrimitiveMember(structure, td),
                .@"struct",
                .arg_struct,
                .variadic_struct,
                => try self.addStructMembers(structure, td),
                .@"union",
                => try self.addUnionMembers(structure, td),
                .pointer,
                => try self.addPointerMember(structure, td),
                .array => try self.addArrayMember(structure, td),
                .slice => try self.addSliceMember(structure, td),
                .error_union => try self.addErrorUnionMembers(structure, td),
                .optional => try self.addOptionalMembers(structure, td),
                .vector => try self.addVectorMember(structure, td),
                .function => try self.addFunctionMember(structure, td),
                else => {},
            }
        }

        fn addPrimitiveMember(self: @This(), structure: Value, comptime td: TypeData) !void {
            try host.attachMember(structure, .{
                .type = getMemberType(td, false),
                .flags = .{},
                .bit_size = td.getBitSize(),
                .bit_offset = 0,
                .byte_size = td.getByteSize(),
                .slot = if (td.isComptimeOnly()) 0 else null,
                .structure = try self.getStructure(td.type),
            }, false);
        }

        fn addArrayMember(self: @This(), structure: Value, comptime td: TypeData) !void {
            const child_td = tdb.get(td.getElementType());
            try host.attachMember(structure, .{
                .type = getMemberType(child_td, false),
                .flags = .{},
                .bit_size = child_td.getBitSize(),
                .byte_size = child_td.getByteSize(),
                .structure = try self.getStructure(child_td.type),
            }, false);
            try self.addSentinelMember(structure, td, child_td);
        }

        fn addSliceMember(self: @This(), structure: Value, comptime td: TypeData) !void {
            const child_td = tdb.get(td.getElementType());
            try host.attachMember(structure, .{
                .type = getMemberType(child_td, false),
                .flags = .{},
                .bit_size = child_td.getBitSize(),
                .byte_size = child_td.getByteSize(),
                .structure = try self.getStructure(child_td.type),
            }, false);
            try self.addSentinelMember(structure, td, child_td);
        }

        fn addSentinelMember(self: @This(), structure: Value, comptime td: TypeData, comptime child_td: TypeData) !void {
            if (comptime td.getSentinel()) |sentinel| {
                try host.attachMember(structure, .{
                    .type = getMemberType(child_td, false),
                    .flags = .{
                        .is_sentinel = true,
                        .is_required = sentinel.is_required,
                    },
                    .bit_offset = 0,
                    .bit_size = child_td.getBitSize(),
                    .byte_size = child_td.getByteSize(),
                    .structure = try self.getStructure(child_td.type),
                }, false);
                const dv = try self.exportPointerTarget(&sentinel.value, false);
                const template = try host.createTemplate(dv);
                try host.attachTemplate(structure, template, false);
            }
        }

        fn addVectorMember(self: @This(), structure: Value, comptime td: TypeData) !void {
            const child_td = tdb.get(td.getElementType());
            try host.attachMember(structure, .{
                .type = getMemberType(child_td, false),
                .flags = .{},
                .bit_size = child_td.getBitSize(),
                .byte_size = if (td.isBitVector()) null else child_td.getByteSize(),
                .structure = try self.getStructure(child_td.type),
            }, false);
        }

        fn addPointerMember(self: @This(), structure: Value, comptime td: TypeData) !void {
            const TT = td.getTargetType();
            try host.attachMember(structure, .{
                .type = getMemberType(td, false),
                .flags = .{},
                .bit_size = td.getBitSize(),
                .byte_size = td.getByteSize(),
                .slot = 0,
                .structure = try self.getStructure(TT),
            }, false);
        }

        fn addStructMembers(self: @This(), structure: Value, comptime td: TypeData) !void {
            const st = @typeInfo(td.type).@"struct";
            inline for (st.fields, 0..) |field, index| {
                const field_td = tdb.get(field.type);
                // comptime fields are not actually stored in the struct
                // fields of comptime types in comptime structs are handled in the same manner
                const is_actual = !field.is_comptime and !field_td.isComptimeOnly();
                const supported = comptime field_td.isSupported();
                try host.attachMember(structure, .{
                    .name = field.name,
                    .type = getMemberType(field_td, field.is_comptime),
                    .flags = .{
                        .is_read_only = !is_actual,
                        .is_required = is_actual and field.default_value == null,
                    },
                    .bit_offset = if (is_actual) @bitOffsetOf(td.type, field.name) else null,
                    .bit_size = if (is_actual) field_td.getBitSize() else null,
                    .byte_size = if (is_actual and !td.isPacked()) field_td.getByteSize() else null,
                    .slot = index,
                    .structure = if (supported) try self.getStructure(field.type) else null,
                }, false);
            }
            if (st.backing_integer) |IT| {
                // add member for backing int
                const int_td = tdb.get(IT);
                try host.attachMember(structure, .{
                    .type = getMemberType(int_td, false),
                    .flags = .{ .is_backing_int = true },
                    .bit_offset = 0,
                    .bit_size = int_td.getBitSize(),
                    .byte_size = int_td.getByteSize(),
                    .structure = try self.getStructure(IT),
                }, false);
            }
            if (!td.isArguments()) {
                // add default values
                var template_maybe: ?Value = null;
                if (@sizeOf(td.type) > 0) {
                    const default_values = comptime init: {
                        var values: td.type = undefined;
                        for (st.fields) |field| {
                            if (!field.is_comptime) {
                                if (field.default_value) |opaque_ptr| {
                                    const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                                    @field(values, field.name) = default_value_ptr.*;
                                }
                            }
                        }
                        break :init values;
                    };
                    const dv = try self.exportPointerTarget(&default_values, false);
                    template_maybe = try host.createTemplate(dv);
                }
                inline for (st.fields, 0..) |field, index| {
                    if (field.default_value) |opaque_ptr| {
                        const field_td = tdb.get(field.type);
                        const comptime_only = field.is_comptime or field_td.isComptimeOnly();
                        if (comptime_only and comptime field_td.isSupported()) {
                            // comptime members aren't stored in the struct's memory
                            // they're separate objects in the slots of the struct template
                            const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                            const value_obj = try self.exportPointerTarget(default_value_ptr, true);
                            template_maybe = template_maybe orelse try host.createTemplate(null);
                            try host.writeSlot(template_maybe.?, index, value_obj);
                        }
                    }
                }
                if (template_maybe) |template| {
                    try host.attachTemplate(structure, template, false);
                }
            }
        }

        fn addUnionMembers(self: @This(), structure: Value, comptime td: TypeData) !void {
            const fields = @typeInfo(td.type).@"union".fields;
            inline for (fields, 0..) |field, index| {
                const field_td = tdb.get(field.type);
                const supported = comptime field_td.isSupported();
                try host.attachMember(structure, .{
                    .name = field.name,
                    .type = getMemberType(field_td, false),
                    .flags = .{
                        .is_read_only = field_td.isComptimeOnly(),
                    },
                    .bit_offset = td.getContentBitOffset(),
                    .bit_size = field_td.getBitSize(),
                    .byte_size = field_td.getByteSize(),
                    .slot = index,
                    .structure = if (supported) try self.getStructure(field_td.type) else null,
                }, false);
            }
            if (td.getSelectorType()) |TT| {
                const selector_td = tdb.get(TT);
                try host.attachMember(structure, .{
                    .type = getMemberType(selector_td, false),
                    .flags = .{ .is_selector = true },
                    .bit_offset = td.getSelectorBitOffset(),
                    .bit_size = selector_td.getBitSize(),
                    .byte_size = selector_td.getByteSize(),
                    .structure = try self.getStructure(selector_td.type),
                }, false);
            }
        }

        fn addOptionalMembers(self: @This(), structure: Value, comptime td: TypeData) !void {
            // value always comes first
            const child_td = tdb.get(@typeInfo(td.type).optional.child);
            try host.attachMember(structure, .{
                .type = getMemberType(child_td, false),
                .flags = .{},
                .bit_offset = 0,
                .bit_size = child_td.getBitSize(),
                .byte_size = child_td.getByteSize(),
                .slot = 0,
                .structure = try self.getStructure(child_td.type),
            }, false);
            const ST = td.getSelectorType().?;
            const selector_td = tdb.get(ST);
            try host.attachMember(structure, .{
                .type = getMemberType(selector_td, false),
                .flags = .{ .is_selector = true },
                .bit_offset = td.getSelectorBitOffset(),
                .bit_size = selector_td.getBitSize(),
                .byte_size = selector_td.getByteSize(),
                .structure = try self.getStructure(selector_td.type),
            }, false);
        }

        fn addErrorUnionMembers(self: @This(), structure: Value, comptime td: TypeData) !void {
            const payload_td = tdb.get(@typeInfo(td.type).error_union.payload);
            try host.attachMember(structure, .{
                .type = getMemberType(payload_td, false),
                .flags = .{},
                .bit_offset = td.getContentBitOffset(),
                .bit_size = payload_td.getBitSize(),
                .byte_size = payload_td.getByteSize(),
                .slot = 0,
                .structure = try self.getStructure(payload_td.type),
            }, false);
            const error_td = tdb.get(@typeInfo(td.type).error_union.error_set);
            try host.attachMember(structure, .{
                .type = getMemberType(error_td, false),
                .flags = .{ .is_selector = true },
                .bit_offset = td.getErrorBitOffset(),
                .bit_size = error_td.getBitSize(),
                .byte_size = error_td.getByteSize(),
                .structure = try self.getStructure(error_td.type),
            }, false);
        }

        fn addFunctionMember(self: @This(), structure: Value, comptime td: TypeData) !void {
            const FT = types.Uninlined(td.type);
            const arg_td = tdb.get(types.ArgumentStruct(FT));
            try host.attachMember(structure, .{
                .type = getMemberType(arg_td, false),
                .flags = .{},
                .bit_size = arg_td.getBitSize(),
                .byte_size = arg_td.getByteSize(),
                .structure = try self.getStructure(arg_td.type),
            }, false);
            // store thunk as instance template
            const thunk = comptime thunk_zig.createThunk(FT);
            const thunk_dv = try self.exportPointerTarget(thunk, false);
            const instance_template = try host.createTemplate(thunk_dv);
            try host.attachTemplate(structure, instance_template, false);
            const PT = *const FT;
            if (comptime tdb.has(PT) and tdb.get(PT).isInUse() and !td.isVariadic()) {
                // store JS thunk controller as static template
                const controller = comptime thunk_js.createThunkController(host, FT);
                const controller_dv = try self.exportPointerTarget(controller, false);
                const static_template = try host.createTemplate(controller_dv);
                try host.attachTemplate(structure, static_template, true);
            }
        }

        fn addStaticMembers(self: @This(), structure: Value, comptime td: TypeData) !void {
            if (td.isSlice()) return;
            var template_maybe: ?Value = null;
            // add declared static members
            comptime var offset = 0;
            switch (@typeInfo(td.type)) {
                inline .@"struct", .@"union", .@"enum", .@"opaque" => |st| {
                    inline for (st.decls, 0..) |decl, index| {
                        const decl_ptr = &@field(td.type, decl.name);
                        const decl_ptr_td = tdb.get(@TypeOf(decl_ptr));
                        if (comptime decl_ptr_td.isSupported()) {
                            const decl_value = decl_ptr.*;
                            const DT = @TypeOf(decl_value);
                            // export type only if it's supported
                            const is_value_supported = switch (DT) {
                                type => tdb.get(decl_value).isSupported(),
                                else => true,
                            };
                            const should_export = if (is_value_supported) switch (@typeInfo(DT)) {
                                .@"fn" => !self.options.omit_methods,
                                else => !self.options.omit_variables or decl_ptr_td.isConst(),
                            } else false;
                            if (should_export) {
                                checkStaticMember(DT);
                                const decl_td = tdb.get(DT);
                                try host.attachMember(structure, .{
                                    .name = decl.name,
                                    .type = .object,
                                    .flags = .{
                                        .is_read_only = decl_ptr_td.isConst(),
                                        .is_method = decl_td.isMethodOf(td.type),
                                    },
                                    .slot = index,
                                    .structure = try self.getStructure(DT),
                                }, true);
                                const target_ptr = comptime switch (@typeInfo(DT)) {
                                    .@"fn" => |f| switch (f.calling_convention) {
                                        .@"inline" => &uninline(decl_value),
                                        else => decl_ptr,
                                    },
                                    else => decl_ptr,
                                };
                                const value_obj = try self.exportPointerTarget(target_ptr, true);
                                template_maybe = template_maybe orelse try host.createTemplate(null);
                                try host.writeSlot(template_maybe.?, index, value_obj);
                            }
                        }
                        offset += 1;
                    }
                },
                else => {},
            }
            // add implicit static members
            switch (@typeInfo(td.type)) {
                .@"enum" => |en| {
                    // add fields as static members
                    inline for (en.fields, 0..) |field, index| {
                        const value = @field(td.type, field.name);
                        const slot = offset + index;
                        try host.attachMember(structure, .{
                            .name = field.name,
                            .type = .object,
                            .flags = .{ .is_part_of_set = true },
                            .slot = slot,
                            .structure = structure,
                        }, true);
                        const value_obj = try self.exportPointerTarget(&value, true);
                        template_maybe = template_maybe orelse try host.createTemplate(null);
                        try host.writeSlot(template_maybe.?, slot, value_obj);
                    }
                },
                .error_set => |es| if (es) |errors| {
                    inline for (errors, 0..) |err_rec, index| {
                        // get error from global set
                        const err = @field(anyerror, err_rec.name);
                        const slot = offset + index;
                        try host.attachMember(structure, .{
                            .name = err_rec.name,
                            .type = .object,
                            .flags = .{ .is_part_of_set = true },
                            .slot = slot,
                            .structure = structure,
                        }, true);
                        // can't use exportPointerTarget(), since each error in the set would be
                        // considered a separate type--need special handling
                        const value_obj = try self.exportError(err, structure);
                        template_maybe = template_maybe orelse try host.createTemplate(null);
                        try host.writeSlot(template_maybe.?, slot, value_obj);
                    }
                },
                else => {},
            }
            if (template_maybe) |template| {
                try host.attachTemplate(structure, template, true);
            }
        }

        fn checkStaticMember(comptime T: anytype) void {
            comptime {
                switch (@typeInfo(T)) {
                    .@"fn" => |f| {
                        var has_abort_signal = false;
                        var has_promise = false;
                        for (f.params) |param| {
                            const param_td = tdb.get(param.type.?);
                            if (param_td.isAbortSignal()) {
                                has_abort_signal = true;
                            } else if (param_td.isPromise()) {
                                has_promise = true;
                            }
                        }
                        if (has_abort_signal and !has_promise) {
                            @compileError("Function accepting AbortSignal as an argument must accept a Promise as well");
                        }
                    },
                    else => {},
                }
            }
        }

        fn exportPointerTarget(self: @This(), comptime ptr: anytype, comptime casting: bool) !Value {
            const pt = @typeInfo(@TypeOf(ptr)).pointer;
            const target_td = tdb.get(pt.child);
            const value_ptr = ptr: {
                // values that only exist at comptime need to have their comptime part replaced with void
                // (comptime keyword needed here since expression evaluates to different pointer types)
                if (comptime target_td.isComptimeOnly()) {
                    var runtime_value: ComptimeFree(target_td.type) = removeComptimeValues(ptr.*);
                    break :ptr &runtime_value;
                } else {
                    break :ptr ptr;
                }
            };
            const is_comptime = comptime pt.is_const and !target_td.isFunction() and !target_td.hasPointer();
            const export_handle = if (!is_comptime) host.getExportHandle(ptr) else null;
            const memory = Memory.from(value_ptr, is_comptime);
            if (casting) {
                const structure = try self.getStructure(target_td.type);
                const obj = try host.castView(memory, structure, export_handle);
                if (comptime target_td.isComptimeOnly()) {
                    try self.attachComptimeValues(obj, ptr.*);
                }
                return obj;
            } else {
                return host.captureView(memory, export_handle);
            }
        }

        fn exportError(_: @This(), err: anyerror, structure: Value) !Value {
            const memory = Memory.from(&err, true);
            const obj = try host.castView(memory, structure, null);
            return obj;
        }

        fn exportComptimeValue(self: @This(), comptime value: anytype) !Value {
            return switch (@typeInfo(@TypeOf(value))) {
                .comptime_int => self.exportPointerTarget(&@as(types.IntType(value), value), true),
                .comptime_float => self.exportPointerTarget(&@as(f64, value), true),
                .enum_literal => self.exportPointerTarget(types.removeSentinel(@tagName(value)), true),
                .type => self.getStructure(value),
                else => return self.exportPointerTarget(&value, true),
            };
        }

        fn attachComptimeValues(self: @This(), target: Value, comptime value: anytype) !void {
            const td = tdb.get(@TypeOf(value));
            switch (@typeInfo(td.type)) {
                .type => {
                    const obj = try self.getStructure(value);
                    try host.writeSlot(target, 0, obj);
                },
                .comptime_int, .comptime_float, .enum_literal => {
                    const obj = try self.exportComptimeValue(value);
                    try host.writeSlot(target, 0, obj);
                },
                .array => {
                    inline for (value, 0..) |element, index| {
                        const obj = try self.exportComptimeValue(element);
                        try host.writeSlot(target, index, obj);
                    }
                },
                .@"struct" => |st| {
                    inline for (st.fields, 0..) |field, index| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isComptimeOnly()) {
                            const field_value = @field(value, field.name);
                            const obj = try self.exportComptimeValue(field_value);
                            try host.writeSlot(target, index, obj);
                        }
                    }
                },
                .@"union" => |un| {
                    if (un.tag_type) |Tag| {
                        const tag: Tag = value;
                        inline for (un.fields, 0..) |field, index| {
                            if (@field(Tag, field.name) == tag) {
                                const field_td = tdb.get(field.type);
                                if (field_td.isComptimeOnly()) {
                                    const field_value = @field(value, field.name);
                                    const obj = try self.exportComptimeValue(field_value);
                                    try host.writeSlot(target, index, obj);
                                }
                            }
                        }
                    } else {
                        @compileError("Unable to handle comptime value in bare union");
                    }
                },
                .optional => {
                    if (value) |v| {
                        const obj = try self.exportComptimeValue(v);
                        try host.writeSlot(target, 0, obj);
                    }
                },
                .error_union => {
                    if (value) |v| {
                        const obj = try self.exportComptimeValue(v);
                        try host.writeSlot(target, 0, obj);
                    } else |_| {}
                },
                else => {},
            }
        }
    };
}

pub fn getFactoryThunk(comptime host: type, comptime module: type) thunk_zig.Thunk {
    const ns = struct {
        fn exportStructures(_: *const anyopaque, arg_ptr: *anyopaque) anyerror!void {
            @setEvalBranchQuota(2000000);
            const options_ptr: *const types.ExportOptions = @ptrCast(@alignCast(arg_ptr));
            const factory: Factory(host, module) = .{ .options = options_ptr.* };
            _ = try factory.getStructure(module);
            return;
        }
    };
    return ns.exportStructures;
}

pub fn getModuleAttributes() types.ModuleAttributes {
    return .{
        .little_endian = builtin.target.cpu.arch.endian() == .little,
        .runtime_safety = switch (builtin.mode) {
            .Debug, .ReleaseSafe => true,
            else => false,
        },
        .libc = builtin.link_libc,
    };
}

fn ComptimeFree(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .comptime_float,
        .comptime_int,
        .enum_literal,
        .type,
        .null,
        .undefined,
        => void,
        .array => |ar| [ar.len]ComptimeFree(ar.child),
        .@"struct" => |st| derive: {
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
                .@"struct" = .{
                    .layout = st.layout,
                    .fields = &new_fields,
                    .decls = &.{},
                    .is_tuple = st.is_tuple,
                },
            });
        },
        .@"union" => |un| derive: {
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
                .@"union" = .{
                    .layout = un.layout,
                    .tag_type = un.tag_type,
                    .fields = &new_fields,
                    .decls = &.{},
                },
            });
        },
        .optional => |op| ?ComptimeFree(op.child),
        .error_union => |eu| eu.error_set!ComptimeFree(eu.payload),
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
        .comptime_float,
        .comptime_int,
        .enum_literal,
        .type,
        .null,
        .undefined,
        => result = {},
        .array => {
            inline for (value, 0..) |element, index| {
                result[index] = removeComptimeValues(element);
            }
        },
        .@"struct" => |st| {
            inline for (st.fields) |field| {
                @field(result, field.name) = removeComptimeValues(@field(value, field.name));
            }
        },
        .@"union" => |un| {
            if (un.tag_type) |Tag| {
                const tag: Tag = value;
                const field_name = @tagName(tag);
                const field_value = @field(value, field_name);
                result = @unionInit(RT, field_name, removeComptimeValues(field_value));
            } else {
                @compileError("Unable to handle comptime value in bare union");
            }
        },
        .optional => result = if (value) |v| removeComptimeValues(v) else null,
        .error_union => result = if (value) |v| removeComptimeValues(v) else |e| e,
        else => result = value,
    }
    return result;
}

fn uninline(comptime func: anytype) types.Uninlined(@TypeOf(func)) {
    const FT = @TypeOf(func);
    const f = @typeInfo(FT).@"fn";
    const ns = struct {
        fn call(args: std.meta.ArgsTuple(FT)) f.return_type.? {
            return @call(.auto, func, args);
        }
    };
    return fn_transform.spreadArgs(ns.call, .Unspecified);
}
