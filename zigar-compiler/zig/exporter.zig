const std = @import("std");
const builtin = @import("builtin");

const meta = @import("meta.zig");
pub const options = @import("options.zig");
const js_fn = @import("thunk/js-fn.zig");
const zig_fn = @import("thunk/zig-fn.zig");
const ArgStruct = @import("type/arg-struct.zig").ArgStruct;
const TypeData = @import("type/db.zig").TypeData;
const TypeDataCollector = @import("type/db.zig").TypeDataCollector;
const util = @import("type/util.zig");
const fn_transform = @import("zigft/fn-transform.zig");

pub const Value = *opaque {};

fn Factory(comptime host: type, comptime module: type) type {
    const tdb = comptime result: {
        var tdc = TypeDataCollector.init(256);
        tdc.add(*const fn (*const anyopaque, *anyopaque) anyerror!void);
        tdc.add(*const fn (*const anyopaque, *anyopaque, *const anyopaque, usize) anyerror!void);
        tdc.add(*const fn (js_fn.Action, usize) anyerror!usize);
        tdc.add(*const anyopaque);
        tdc.scan(module);
        break :result tdc.createDatabase();
    };
    return struct {
        pub fn getStructureType(comptime td: TypeData) StructureType {
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

        pub fn getStructurePurpose(comptime td: TypeData) StructurePurpose {
            return switch (td.type) {
                std.mem.Allocator => .allocator,
                std.fs.File => .file,
                std.fs.Dir => .directory,
                else => get: {
                    if (td.isIterator()) break :get .iterator;
                    if (util.getInternalType(td.type)) |it| break :get switch (it) {
                        .promise => .promise,
                        .generator => .generator,
                        .abort_signal => .abort_signal,
                        else => unreachable,
                    };
                    break :get .unknown;
                },
            };
        }

        pub fn getStructureFlags(comptime td: TypeData) switch (@typeInfo(td.type)) {
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
            => StructureFlags.Primitive,
            .@"struct" => if (td.isArguments())
                StructureFlags.ArgStruct
            else if (td.isSlice())
                StructureFlags.Slice
            else
                StructureFlags.Struct,
            .@"union" => StructureFlags.Union,
            .error_union => StructureFlags.ErrorUnion,
            .optional => StructureFlags.Optional,
            .@"enum" => StructureFlags.Enum,
            .error_set => StructureFlags.ErrorSet,
            .array => StructureFlags.Array,
            .vector => StructureFlags.Vector,
            .pointer => StructureFlags.Pointer,
            .@"opaque" => StructureFlags.Opaque,
            .@"fn" => StructureFlags.Function,
            else => @compileError("Unknown structure: " ++ @typeName(td.type)),
        } {
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
                    .has_slot = td.isComptimeOnly(),
                    .is_size = td.type == usize or td.type == isize,
                },
                .@"struct" => |st| init: {
                    const has_object = inline for (st.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject()) break true;
                    } else false;
                    const has_slot = inline for (st.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject() or field_td.isComptimeOnly() or field.is_comptime) break true;
                    } else false;
                    break :init if (comptime td.isArguments()) .{
                        .has_object = has_object,
                        .has_slot = has_slot,
                        .has_pointer = td.hasPointer(),
                        .has_options = inline for (st.fields) |field| {
                            const field_td = tdb.get(field.type);
                            if (getStructurePurpose(field_td).isOptional()) break true;
                        } else false,
                        .is_throwing = td.isThrowing(),
                        .is_async = inline for (st.fields) |field| {
                            const field_td = tdb.get(field.type);
                            switch (getStructurePurpose(field_td)) {
                                .promise, .generator => break true,
                                else => {},
                            }
                        } else false,
                    } else if (comptime td.isSlice()) .{
                        .has_object = has_object,
                        .has_slot = has_slot,
                        .has_pointer = td.hasPointer(),
                        .has_sentinel = td.type.sentinel != null,
                        .is_string = td.getElementType() == u8 or td.getElementType() == u16,
                        .is_typed_array = canBeTypedArray(td.type),
                        .is_clamped_array = canBeClampedArray(td.type),
                        .is_opaque = td.type.is_opaque,
                    } else .{
                        .has_object = has_object,
                        .has_slot = has_slot,
                        .has_pointer = td.hasPointer(),
                        .is_extern = st.layout == .@"extern",
                        .is_packed = st.layout == .@"packed",
                        .is_tuple = st.is_tuple,
                        .is_optional = util.hasDefaultFields(td.type),
                    };
                },
                .@"union" => |un| init: {
                    const has_object = inline for (un.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject()) break true;
                    } else false;
                    const has_slot = inline for (un.fields) |field| {
                        const field_td = tdb.get(field.type);
                        if (field_td.isObject() or field_td.isComptimeOnly()) break true;
                    } else false;
                    break :init .{
                        .has_object = has_object,
                        .has_slot = has_slot,
                        .has_pointer = td.hasPointer(),
                        .has_tag = un.tag_type != null,
                        .has_inaccessible = un.tag_type == null and td.hasPointer(),
                        .has_selector = td.hasSelector(),
                        .is_extern = un.layout == .@"extern",
                        .is_packed = un.layout == .@"packed",
                    };
                },
                .error_union => |eu| init: {
                    const payload_td = tdb.get(eu.payload);
                    break :init .{
                        .has_object = payload_td.isObject(),
                        .has_slot = payload_td.isObject() or payload_td.isComptimeOnly(),
                        .has_pointer = td.hasPointer(),
                    };
                },
                .optional => |op| init: {
                    const child_td = tdb.get(op.child);
                    break :init .{
                        .has_object = child_td.isObject(),
                        .has_slot = child_td.isObject() or child_td.isComptimeOnly(),
                        .has_pointer = td.hasPointer(),
                        .has_selector = td.hasSelector(),
                    };
                },
                .@"enum" => |en| .{
                    .is_open_ended = !en.is_exhaustive,
                },
                .error_set => |es| .{
                    .is_global = es == null,
                },
                .array => |ar| init: {
                    const child_td = tdb.get(ar.child);
                    break :init .{
                        .has_object = child_td.isObject(),
                        .has_slot = child_td.isObject() or child_td.isComptimeOnly(),
                        .has_pointer = child_td.hasPointer(),
                        .has_sentinel = td.getSentinel() != null,
                        .is_string = td.getElementType() == u8 or td.getElementType() == u16,
                        .is_typed_array = canBeTypedArray(td.type),
                        .is_clamped_array = canBeClampedArray(td.type),
                    };
                },
                .vector => |ve| init: {
                    const child_td = tdb.get(ve.child);
                    break :init .{
                        .has_object = child_td.isObject(),
                        .has_slot = child_td.isObject(),
                        .has_pointer = child_td.hasPointer(),
                        .is_typed_array = canBeTypedArray(td.type),
                    };
                },
                .pointer => |pt| .{
                    .has_length = pt.size == .slice,
                    .has_proxy = switch (@typeInfo(pt.child)) {
                        .pointer => pt.size != .one, // .one pointer doesn't need a proxy
                        .@"fn" => false,
                        else => true,
                    },
                    .is_const = pt.is_const,
                    .is_single = pt.size == .one or pt.size == .c,
                    .is_multiple = pt.size != .one,
                    .is_nullable = pt.is_allowzero or pt.child == anyopaque,
                },
                .@"opaque" => .{},
                .@"fn" => .{},
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
                            // first field is retval
                            if (index > 0) {
                                const field_td = tdb.get(field.type);
                                const purpose = getStructurePurpose(field_td);
                                if (!purpose.isOptional()) len += 1;
                            }
                        }
                        break :req_arg_count len;
                    },
                    false => switch (st.is_tuple) {
                        true => st.fields.len,
                        false => null,
                    },
                },
                .@"fn" => getStructureLength(tdb.get(ArgStruct(td.type))),
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
                .@"struct", .@"union", .@"enum" => result: {
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

        pub fn getMemberType(comptime td: TypeData, comptime is_comptime: bool) MemberType {
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

        // NOTE: anyerror has to be used here since the function is called recursively
        // and https://github.com/ziglang/zig/issues/2971 has not been fully resolved yet
        fn getStructure(self: @This(), comptime T: type) anyerror!Value {
            const td = tdb.get(T);
            const slot = td.getSlot();
            return host.getSlotValue(null, slot) catch result: {
                const instance = try createObject(.{});
                const static = try createObject(.{});
                const structure = try createObject(.{
                    .name = getStructureName(td),
                    .type = getStructureType(td),
                    .purpose = getStructurePurpose(td),
                    .flags = getStructureFlags(td),
                    .signature = td.getSignature(),
                    .length = getStructureLength(td),
                    .byteSize = td.getByteSize(),
                    .@"align" = td.getAlignment(),
                    .instance = instance,
                    .static = static,
                });
                // place the structure its slot immediately so that recursive definition works correctly
                try host.setSlotValue(null, slot, structure);
                // define members and add template if applicable
                try setProperties(instance, .{
                    .members = try self.getMembers(td),
                    .template = try self.getTemplate(td),
                });
                // define the shape so that static members can be instances of the structure
                try host.beginStructure(structure);
                // add static variables and functions, excluding internal util and problematic namespaces
                if (comptime !td.shouldIgnoreDecls()) {
                    try setProperties(static, .{
                        .members = try self.getStaticMembers(td),
                        .template = try self.getStaticTemplate(td),
                    });
                }
                // indicate that structure is complete
                try host.finishStructure(structure);
                break :result structure;
            };
        }

        fn getMembers(self: @This(), comptime td: TypeData) !Value {
            const list = try createList(.{});
            switch (comptime getStructureType(td)) {
                .primitive, .error_set, .@"enum" => try self.addPrimitiveMember(list, td),
                .arg_struct, .variadic_struct => try self.addArgStructMembers(list, td),
                .@"struct" => try self.addStructMembers(list, td),
                .@"union" => try self.addUnionMembers(list, td),
                .pointer => try self.addPointerMember(list, td),
                .array => try self.addArrayMember(list, td),
                .slice => try self.addSliceMember(list, td),
                .error_union => try self.addErrorUnionMembers(list, td),
                .optional => try self.addOptionalMembers(list, td),
                .vector => try self.addVectorMember(list, td),
                .function => try self.addFunctionMember(list, td),
                else => {},
            }
            return list;
        }

        fn addPrimitiveMember(self: @This(), list: Value, comptime td: TypeData) !void {
            try appendList(list, .{
                .type = getMemberType(td, false),
                .bitSize = td.getBitSize(),
                .byteSize = td.getByteSize(),
                .bitOffset = 0,
                .slot = if (td.isComptimeOnly()) @as(usize, 0) else null,
                .structure = try self.getStructure(td.type),
            });
        }

        fn addArrayMember(self: @This(), list: Value, comptime td: TypeData) !void {
            const child_td = tdb.get(td.getElementType());
            try appendList(list, .{
                .type = getMemberType(child_td, false),
                .bitSize = child_td.getBitSize(),
                .byteSize = child_td.getByteSize(),
                .structure = try self.getStructure(child_td.type),
            });
            try self.addSentinelMember(list, td, child_td);
        }

        fn addSliceMember(self: @This(), list: Value, comptime td: TypeData) !void {
            const child_td = tdb.get(td.getElementType());
            try appendList(list, .{
                .type = getMemberType(child_td, false),
                .bitSize = child_td.getBitSize(),
                .byteSize = child_td.getByteSize(),
                .structure = try self.getStructure(child_td.type),
            });
            try self.addSentinelMember(list, td, child_td);
        }

        fn addSentinelMember(self: @This(), list: Value, comptime td: TypeData, comptime child_td: TypeData) !void {
            if (comptime td.getSentinel()) |sentinel| {
                try appendList(list, .{
                    .type = getMemberType(child_td, false),
                    .flags = MemberFlags{
                        .is_sentinel = true,
                        .is_required = sentinel.is_required,
                    },
                    .bitSize = child_td.getBitSize(),
                    .byteSize = child_td.getByteSize(),
                    .structure = try self.getStructure(child_td.type),
                });
            }
        }

        fn addVectorMember(self: @This(), list: Value, comptime td: TypeData) !void {
            const child_td = tdb.get(td.getElementType());
            try appendList(list, .{
                .type = getMemberType(child_td, false),
                .bitSize = child_td.getBitSize(),
                .byteSize = if (td.isBitVector()) null else child_td.getByteSize(),
                .structure = try self.getStructure(child_td.type),
            });
        }

        fn addPointerMember(self: @This(), list: Value, comptime td: TypeData) !void {
            const TT = td.getTargetType();
            try appendList(list, .{
                .type = getMemberType(td, false),
                .bitSize = td.getBitSize(),
                .byteSize = td.getByteSize(),
                .slot = 0,
                .structure = try self.getStructure(TT),
            });
        }

        fn addArgStructMembers(self: @This(), list: Value, comptime td: TypeData) !void {
            const FT = td.parent_type.?;
            // check if FT is used as a function pointer
            const PT = *const FT;
            const as_ptr = comptime tdb.has(PT) and tdb.get(PT).isInUse() and !td.isVariadic();
            inline for (std.meta.fields(td.type), 0..) |field, index| {
                const field_td = tdb.get(field.type);
                const can_be_string = comptime (as_ptr and index > 0) and canBeString(field.type);
                // first field is retval, hence the subtraction
                const is_string = comptime can_be_string and meta.call("isArgumentString", .{ FT, index - 1 });
                const can_be_clamped_array = comptime (as_ptr and index > 0) and !is_string and canBeClampedArray(field.type);
                const is_clamped_array = comptime can_be_clamped_array and meta.call("isArgumentClampedArray", .{ FT, index - 1 });
                const can_be_typed_array = comptime (as_ptr and index > 0) and !is_string and !is_clamped_array and canBeTypedArray(field.type);
                const is_typed_array = comptime can_be_typed_array and meta.call("isArgumentTypedArray", .{ FT, index - 1 });
                const can_be_plain = comptime (as_ptr and index > 0) and !is_string and !is_typed_array and !is_clamped_array and canBePlain(field.type);
                const is_plain = comptime can_be_plain and meta.call("isArgumentPlain", .{ FT, index - 1 });
                try appendList(list, .{
                    .name = field.name,
                    .type = getMemberType(field_td, field.is_comptime),
                    .flags = MemberFlags{
                        .is_required = true,
                        .is_string = is_string,
                        .is_plain = is_plain,
                        .is_typed_array = is_typed_array,
                        .is_clamped_array = is_clamped_array,
                    },
                    .bitOffset = @bitOffsetOf(td.type, field.name),
                    .bitSize = field_td.getBitSize(),
                    .byteSize = field_td.getByteSize(),
                    .slot = index,
                    .structure = try self.getStructure(field.type),
                });
            }
        }

        fn addStructMembers(self: @This(), list: Value, comptime td: TypeData) !void {
            const FieldEnum = std.meta.FieldEnum(td.type);
            inline for (std.meta.fields(td.type), 0..) |field, index| {
                const field_td = tdb.get(field.type);
                const field_enum = comptime std.meta.stringToEnum(FieldEnum, field.name).?;
                // comptime fields are not actually stored in the struct
                // fields of comptime util in comptime structs are handled in the same manner
                const is_actual = comptime !field.is_comptime and !field_td.isComptimeOnly();
                // check meta function to see if field should be handled in a special manner
                const can_be_string = comptime canBeString(field.type);
                const is_string = comptime can_be_string and meta.call("isFieldString", .{ td.type, field_enum });
                const can_be_clamped_array = comptime !is_string and canBeClampedArray(field.type);
                const is_clamped_array = comptime can_be_clamped_array and meta.call("isFieldClampedArray", .{ td.type, field_enum });
                const can_be_typed_array = comptime !is_string and !is_clamped_array and canBeTypedArray(field.type);
                const is_typed_array = comptime can_be_typed_array and meta.call("isFieldTypedArray", .{ td.type, field_enum });
                const can_be_plain = comptime !is_string and !is_typed_array and !is_clamped_array and canBePlain(field.type);
                const is_plain = comptime can_be_plain and meta.call("isFieldPlain", .{ td.type, field_enum });
                const supported = comptime field_td.isSupported();
                try appendList(list, .{
                    .name = field.name,
                    .type = getMemberType(field_td, field.is_comptime),
                    .flags = MemberFlags{
                        .is_read_only = !is_actual,
                        .is_required = is_actual and field.default_value_ptr == null,
                        .is_string = is_string,
                        .is_plain = is_plain,
                        .is_typed_array = is_typed_array,
                        .is_clamped_array = is_clamped_array,
                    },
                    .bitOffset = if (is_actual) @bitOffsetOf(td.type, field.name) else null,
                    .bitSize = if (is_actual) field_td.getBitSize() else null,
                    .byteSize = if (is_actual and !td.isPacked()) field_td.getByteSize() else null,
                    .slot = index,
                    .structure = if (supported) try self.getStructure(field.type) else null,
                });
            }
            if (@typeInfo(td.type).@"struct".backing_integer) |IT| {
                // add member for backing int
                const int_td = tdb.get(IT);
                try appendList(list, .{
                    .type = getMemberType(int_td, false),
                    .flags = MemberFlags{ .is_backing_int = true },
                    .bitSize = int_td.getBitSize(),
                    .byteSize = int_td.getByteSize(),
                    .bitOffset = 0,
                    .structure = try self.getStructure(IT),
                });
            }
        }

        fn addUnionMembers(self: @This(), list: Value, comptime td: TypeData) !void {
            const FieldEnum = std.meta.FieldEnum(td.type);
            inline for (std.meta.fields(td.type), 0..) |field, index| {
                const field_td = tdb.get(field.type);
                const field_enum = comptime std.meta.stringToEnum(FieldEnum, field.name).?;
                const can_be_string = comptime canBeString(field.type);
                const is_string = comptime can_be_string and meta.call("isFieldString", .{ td.type, field_enum });
                const can_be_clamped_array = comptime !is_string and canBeClampedArray(field.type);
                const is_clamped_array = comptime can_be_clamped_array and meta.call("isFieldClampedArray", .{ td.type, field_enum });
                const can_be_typed_array = comptime !is_string and !is_clamped_array and canBeTypedArray(field.type);
                const is_typed_array = comptime can_be_typed_array and meta.call("isFieldTypedArray", .{ td.type, field_enum });
                const can_be_plain = comptime !is_string and !is_typed_array and !is_clamped_array and canBePlain(field.type);
                const is_plain = comptime can_be_plain and meta.call("isFieldPlain", .{ td.type, field_enum });
                const supported = comptime field_td.isSupported();
                try appendList(list, .{
                    .name = field.name,
                    .type = getMemberType(field_td, false),
                    .flags = MemberFlags{
                        .is_read_only = field_td.isComptimeOnly(),
                        .is_string = is_string,
                        .is_plain = is_plain,
                        .is_typed_array = is_typed_array,
                        .is_clamped_array = is_clamped_array,
                    },
                    .bitOffset = td.getContentBitOffset(),
                    .bitSize = field_td.getBitSize(),
                    .byteSize = field_td.getByteSize(),
                    .slot = index,
                    .structure = if (supported) try self.getStructure(field_td.type) else null,
                });
            }
            if (td.getSelectorType()) |TT| {
                const selector_td = tdb.get(TT);
                try appendList(list, .{
                    .type = getMemberType(selector_td, false),
                    .flags = MemberFlags{ .is_selector = true },
                    .bitOffset = td.getSelectorBitOffset(),
                    .bitSize = selector_td.getBitSize(),
                    .byteSize = selector_td.getByteSize(),
                    .structure = try self.getStructure(selector_td.type),
                });
            }
        }

        fn addOptionalMembers(self: @This(), list: Value, comptime td: TypeData) !void {
            // value always comes first
            const child_td = tdb.get(@typeInfo(td.type).optional.child);
            try appendList(list, .{
                .type = getMemberType(child_td, false),
                .bitSize = child_td.getBitSize(),
                .byteSize = child_td.getByteSize(),
                .bitOffset = 0,
                .slot = 0,
                .structure = try self.getStructure(child_td.type),
            });
            const ST = td.getSelectorType().?;
            const selector_td = tdb.get(ST);
            try appendList(list, .{
                .type = getMemberType(selector_td, false),
                .flags = MemberFlags{ .is_selector = true },
                .bitOffset = td.getSelectorBitOffset(),
                .bitSize = selector_td.getBitSize(),
                .byteSize = selector_td.getByteSize(),
                .structure = try self.getStructure(selector_td.type),
            });
        }

        fn addErrorUnionMembers(self: @This(), list: Value, comptime td: TypeData) !void {
            const payload_td = tdb.get(@typeInfo(td.type).error_union.payload);
            try appendList(list, .{
                .type = getMemberType(payload_td, false),
                .bitOffset = td.getContentBitOffset(),
                .bitSize = payload_td.getBitSize(),
                .byteSize = payload_td.getByteSize(),
                .slot = 0,
                .structure = try self.getStructure(payload_td.type),
            });
            // don't export inferred error sets that are essentially anyerror as separate sets
            comptime var ES = @typeInfo(td.type).error_union.error_set;
            if (@typeInfo(ES).error_set == null) {
                ES = anyerror;
            }
            const error_td = tdb.get(ES);
            try appendList(list, .{
                .type = getMemberType(error_td, false),
                .flags = MemberFlags{ .is_selector = true },
                .bitOffset = td.getErrorBitOffset(),
                .bitSize = error_td.getBitSize(),
                .byteSize = error_td.getByteSize(),
                .structure = try self.getStructure(error_td.type),
            });
        }

        fn addFunctionMember(self: @This(), list: Value, comptime td: TypeData) !void {
            const FT = fn_transform.Uninlined(td.type);
            const arg_td = tdb.get(ArgStruct(FT));
            try appendList(list, .{
                .type = getMemberType(arg_td, false),
                .bitSize = arg_td.getBitSize(),
                .byteSize = arg_td.getByteSize(),
                .structure = try self.getStructure(arg_td.type),
            });
        }

        fn getTemplate(self: @This(), comptime td: TypeData) !?Value {
            var memory: ?Value = null;
            var slots: ?Value = null;
            switch (@typeInfo(td.type)) {
                .@"struct" => |st| if (comptime td.isSlice()) {
                    if (comptime td.getSentinel()) |sentinel| {
                        memory = try self.exportPointerTarget(&sentinel.value, false);
                    }
                } else if (!comptime td.isArguments()) {
                    if (@sizeOf(td.type) > 0) {
                        const default_values = comptime init: {
                            var values: td.type = undefined;
                            for (st.fields) |field| {
                                if (!field.is_comptime) {
                                    if (field.default_value_ptr) |opaque_ptr| {
                                        const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                                        @field(values, field.name) = default_value_ptr.*;
                                    }
                                }
                            }
                            break :init values;
                        };
                        memory = try self.exportPointerTarget(&default_values, false);
                    }
                    inline for (st.fields, 0..) |field, index| {
                        if (field.default_value_ptr) |opaque_ptr| {
                            const field_td = tdb.get(field.type);
                            const comptime_only = field.is_comptime or field_td.isComptimeOnly();
                            if (comptime_only and comptime field_td.isSupported()) {
                                // comptime members aren't stored in the struct's memory
                                // they're separate objects in the slots of the static template
                                const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                                const value_obj = try self.exportPointerTarget(default_value_ptr, true);
                                if (slots == null) slots = try host.createObject();
                                try host.setSlotValue(slots, index, value_obj);
                            }
                        }
                    }
                },
                .@"fn" => {
                    const FT = fn_transform.Uninlined(td.type);
                    const thunk = comptime zig_fn.createThunk(FT);
                    memory = try self.exportPointerTarget(thunk, false);
                },
                .array => if (comptime td.getSentinel()) |sentinel| {
                    memory = try self.exportPointerTarget(&sentinel.value, false);
                },
                .pointer => if (comptime td.isSlice()) {
                    if (comptime td.getSentinel()) |sentinel| {
                        memory = try self.exportPointerTarget(&sentinel.value, false);
                    }
                },
                else => {},
            }
            const flags = getStructureFlags(td);
            // add slots to template if the structure is using them
            if (slots == null and flags.has_slot) slots = try host.createObject();
            if (memory == null and slots == null) return null;
            return try host.createTemplate(memory, slots);
        }

        fn getStaticMembers(self: @This(), comptime td: TypeData) !?Value {
            comptime var offset: usize = 0;
            const list = try createList(.{});
            switch (@typeInfo(td.type)) {
                .@"struct", .@"union", .@"enum", .@"opaque" => if (comptime !td.isArguments() and !td.isSlice()) {
                    const DeclEnum = std.meta.DeclEnum(td.type);
                    inline for (comptime std.meta.declarations(td.type), 0..) |decl, index| {
                        if (comptime std.mem.startsWith(u8, decl.name, "meta(")) continue;
                        const decl_enum = comptime std.meta.stringToEnum(DeclEnum, decl.name).?;
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
                                .@"fn" => !options.omit_functions,
                                else => !options.omit_variables or decl_ptr_td.isConst(),
                            } else false;
                            if (should_export) {
                                checkStaticMember(DT);
                                const decl_td = tdb.get(DT);
                                const can_be_string = comptime canBeString(DT);
                                const is_string = comptime can_be_string and meta.call("isDeclString", .{ td.type, decl_enum });
                                const can_be_clamped_array = comptime !is_string and canBeClampedArray(DT);
                                const is_clamped_array = comptime can_be_clamped_array and meta.call("isDeclClampedArray", .{ td.type, decl_enum });
                                const can_be_typed_array = comptime !is_string and !is_clamped_array and canBeTypedArray(DT);
                                const is_typed_array = comptime can_be_typed_array and meta.call("isDeclTypedArray", .{ td.type, decl_enum });
                                const can_be_plain = comptime !is_string and !is_typed_array and !is_clamped_array and canBePlain(DT);
                                const is_plain = comptime can_be_plain and meta.call("isDeclPlain", .{ td.type, decl_enum });
                                try appendList(list, .{
                                    .name = decl.name,
                                    .type = MemberType.object,
                                    .flags = MemberFlags{
                                        .is_read_only = decl_ptr_td.isConst(),
                                        .is_method = decl_td.isMethodOf(td.type),
                                        .is_expecting_instance = decl_td.isExpectingInstanceOf(td.type),
                                        .is_string = is_string,
                                        .is_plain = is_plain,
                                        .is_typed_array = is_typed_array,
                                        .is_clamped_array = is_clamped_array,
                                    },
                                    .slot = index,
                                    .structure = try self.getStructure(DT),
                                });
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
                        try appendList(list, .{
                            .name = field.name,
                            .type = MemberType.object,
                            .flags = MemberFlags{ .is_part_of_set = true },
                            .slot = offset + index,
                            .structure = try self.getStructure(td.type),
                        });
                    }
                },
                .error_set => |es| if (es) |errors| {
                    inline for (errors, 0..) |err_rec, index| {
                        try appendList(list, .{
                            .name = err_rec.name,
                            .type = MemberType.object,
                            .flags = MemberFlags{ .is_part_of_set = true },
                            .slot = index,
                            .structure = try self.getStructure(td.type),
                        });
                    }
                },
                else => {},
            }
            return list;
        }

        fn getStaticTemplate(self: @This(), comptime td: TypeData) !?Value {
            comptime var offset: usize = 0;
            var memory: ?Value = null;
            var slots: ?Value = null;
            switch (@typeInfo(td.type)) {
                .@"struct", .@"union", .@"enum", .@"opaque" => if (comptime !td.isArguments()) {
                    inline for (comptime std.meta.declarations(td.type), 0..) |decl, index| {
                        if (comptime std.mem.startsWith(u8, decl.name, "meta(")) continue;
                        const decl_ptr = &@field(td.type, decl.name);
                        const decl_ptr_td = tdb.get(@TypeOf(decl_ptr));
                        if (comptime decl_ptr_td.isSupported()) {
                            const decl_value = decl_ptr.*;
                            const DT = @TypeOf(decl_value);
                            const is_value_supported = switch (DT) {
                                type => tdb.get(decl_value).isSupported(),
                                else => true,
                            };
                            const should_export = if (is_value_supported) switch (@typeInfo(DT)) {
                                .@"fn" => !options.omit_functions,
                                else => !options.omit_variables or decl_ptr_td.isConst(),
                            } else false;
                            if (should_export) {
                                const target_ptr = comptime switch (@typeInfo(DT)) {
                                    .@"fn" => |f| switch (f.calling_convention) {
                                        .@"inline" => &fn_transform.uninline(decl_value),
                                        else => decl_ptr,
                                    },
                                    else => decl_ptr,
                                };
                                const value_obj = try self.exportPointerTarget(target_ptr, true);
                                if (slots == null) slots = try host.createObject();
                                try host.setSlotValue(slots.?, index, value_obj);
                            }
                        }
                        offset += 1;
                    }
                },
                else => {},
            }
            switch (@typeInfo(td.type)) {
                .@"enum" => |en| {
                    inline for (en.fields, 0..) |field, index| {
                        const value = @field(td.type, field.name);
                        const value_obj = try self.exportPointerTarget(&value, true);
                        if (slots == null) slots = try host.createObject();
                        try host.setSlotValue(slots.?, offset + index, value_obj);
                    }
                },
                .error_set => |es| if (es) |errors| {
                    inline for (errors, 0..) |err_rec, index| {
                        const err = @field(anyerror, err_rec.name);
                        const value_obj = try self.exportError(err, td);
                        if (slots == null) slots = try host.createObject();
                        try host.setSlotValue(slots.?, offset + index, value_obj);
                    }
                },
                .@"fn" => {
                    // only export thunk controller where function pointer is in use
                    const FT = fn_transform.Uninlined(td.type);
                    const PT = *const FT;
                    if (comptime tdb.has(PT) and tdb.get(PT).isInUse() and !td.isVariadic()) {
                        // store JS thunk controller as static template
                        const controller = comptime js_fn.createThunkController(host, FT);
                        memory = try self.exportPointerTarget(controller, false);
                    }
                },
                else => {},
            }
            if (memory == null and slots == null) return null;
            return host.createTemplate(memory, slots);
        }

        fn checkStaticMember(comptime T: anytype) void {
            comptime {
                switch (@typeInfo(T)) {
                    .@"fn" => |f| {
                        var has_abort_signal = false;
                        var has_promise = false;
                        for (f.params) |param| {
                            const param_td = tdb.get(param.type.?);
                            switch (getStructurePurpose((param_td))) {
                                .abort_signal => has_abort_signal = true,
                                .promise => has_promise = true,
                                else => {},
                            }
                        }
                        if (has_abort_signal and !has_promise) {
                            @compileError("Function accepting AbortSignal as an argument must accept a Promise as well: " ++ @typeName(T));
                        }
                    },
                    else => {},
                }
            }
        }

        fn getTypedArrayType(comptime T: type) ?std.builtin.Type.Int {
            return switch (@typeInfo(T)) {
                .int => |int| inline for (.{ 8, 16, 32, 64 }) |bits| {
                    if (int.bits == bits) break .{ .bits = bits, .signedness = int.signedness };
                } else null,
                .float => |float| inline for (.{ 32, 64 }) |bits| {
                    if (float.bits == bits) break .{ .bits = bits, .signedness = .signed };
                } else null,
                .array => |ar| getTypedArrayType(ar.child),
                .vector => |ve| getTypedArrayType(ve.child),
                .@"struct" => switch (comptime @hasDecl(T, "ElementType") and tdb.get(T).isSlice()) {
                    true => getTypedArrayType(T.ElementType),
                    false => null,
                },
                else => null,
            };
        }

        fn canBeString(comptime T: type) bool {
            return switch (@typeInfo(T)) {
                .pointer => |pt| switch (pt.size) {
                    .one => canBeString(pt.child),
                    .many, .c => if (pt.sentinel_ptr != null) pt.child == u8 or pt.child == u16 else false,
                    .slice => pt.child == u8 or pt.child == u16,
                },
                .array => |pt| pt.child == u8 or pt.child == u16,
                .optional => |op| canBeString(op.child),
                .error_union => |eu| canBeString(eu.payload),
                .@"fn" => |f| inline for (f.params) |param| {
                    if (param.type) |PT| {
                        if (comptime util.getInternalType(PT)) |internal_type| {
                            if (internal_type == .promise or internal_type == .generator) {
                                if (canBeString(PT.payload)) break true;
                            }
                        }
                    }
                } else if (f.return_type) |RT| canBeString(RT) else false,
                else => false,
            };
        }

        fn canBePlain(comptime T: type) bool {
            return switch (@typeInfo(T)) {
                .pointer => |pt| switch (pt.size) {
                    .one, .c => canBePlain(pt.child),
                    .slice => true,
                    else => false,
                },
                .@"struct", .@"union", .array, .vector, .@"enum" => true,
                .optional => |op| canBePlain(op.child),
                .error_union => |eu| canBePlain(eu.payload),
                .@"fn" => |f| inline for (f.params) |param| {
                    if (param.type) |PT| {
                        if (comptime util.getInternalType(PT)) |internal_type| {
                            if (internal_type == .promise or internal_type == .generator) {
                                if (canBePlain(PT.payload)) break true;
                            }
                        }
                    }
                } else if (f.return_type) |RT| canBePlain(RT) else false,
                else => false,
            };
        }

        fn canBeTypedArray(comptime T: type) bool {
            return switch (@typeInfo(T)) {
                .pointer => canBeTypedArray(tdb.get(T).getTargetType()),
                .@"fn" => |f| inline for (f.params) |param| {
                    if (param.type) |PT| {
                        if (comptime util.getInternalType(PT)) |internal_type| {
                            if (internal_type == .promise or internal_type == .generator) {
                                if (canBeTypedArray(PT.payload)) break true;
                            }
                        }
                    }
                } else if (f.return_type) |RT| canBeTypedArray(RT) else false,
                .int, .float => false,
                else => getTypedArrayType(T) != null,
            };
        }

        fn canBeClampedArray(comptime T: type) bool {
            return switch (@typeInfo(T)) {
                .pointer => canBeClampedArray(tdb.get(T).getTargetType()),
                .@"fn" => |f| inline for (f.params) |param| {
                    if (param.type) |PT| {
                        if (comptime util.getInternalType(PT)) |internal_type| {
                            if (internal_type == .promise or internal_type == .generator) {
                                if (canBeClampedArray(PT.payload)) break true;
                            }
                        }
                    }
                } else if (f.return_type) |RT| canBeClampedArray(RT) else false,
                .int, .float => false,
                else => if (getTypedArrayType(T)) |i| i.bits == 8 and i.signedness == .unsigned else false,
            };
        }

        fn exportPointerTarget(self: @This(), comptime ptr: anytype, comptime casting: bool) !Value {
            const pt = @typeInfo(@TypeOf(ptr)).pointer;
            const target_td = tdb.get(pt.child);
            const value_ptr = ptr: {
                // values that only exist at comptime need to have their comptime part replaced with void
                // (comptime keyword needed here since expression evaluates to different pointer util)
                if (comptime target_td.isComptimeOnly()) {
                    var runtime_value: ComptimeFree(target_td.type) = removeComptimeValues(ptr.*);
                    break :ptr &runtime_value;
                } else {
                    break :ptr ptr;
                }
            };
            const is_comptime = comptime pt.is_const and !target_td.isFunction() and !target_td.hasPointer();
            const export_handle = if (!is_comptime) host.getExportHandle(ptr) else null;
            if (casting) {
                const structure = try self.getStructure(target_td.type);
                const comptime_values = switch (comptime target_td.isComptimeOnly()) {
                    true => try self.getComptimeValues(ptr.*),
                    false => null,
                };
                const obj = try createInstance(structure, value_ptr, is_comptime, export_handle, comptime_values);
                return obj;
            } else {
                return createView(value_ptr, is_comptime, export_handle);
            }
        }

        fn exportError(self: @This(), err: anyerror, comptime td: TypeData) !Value {
            const structure = try self.getStructure(td.type);
            return try createInstance(structure, &err, true, null, null);
        }

        fn exportComptimeValue(self: @This(), comptime value: anytype) !Value {
            return switch (@typeInfo(@TypeOf(value))) {
                .comptime_int => self.exportPointerTarget(&@as(util.IntFor(value), value), true),
                .comptime_float => self.exportPointerTarget(&@as(f64, value), true),
                .enum_literal => self.exportPointerTarget(util.removeSentinel(@tagName(value)), true),
                .type => self.getStructure(value),
                else => return self.exportPointerTarget(&value, true),
            };
        }

        fn getComptimeValues(self: @This(), comptime value: anytype) !Value {
            const T = @TypeOf(value);
            const slots = try host.createObject();
            switch (@typeInfo(T)) {
                .type => {
                    const object = try self.getStructure(value);
                    try host.setSlotValue(slots, 0, object);
                },
                .comptime_int, .comptime_float, .enum_literal => {
                    const object = try self.exportComptimeValue(value);
                    try host.setSlotValue(slots, 0, object);
                },
                .optional => if (value) |v| {
                    const object = try self.exportComptimeValue(v);
                    try host.setSlotValue(slots, 0, object);
                },
                .error_union => if (value) |v| {
                    const object = try self.exportComptimeValue(v);
                    try host.setSlotValue(slots, 0, object);
                } else |_| {},
                .array => inline for (value, 0..) |element, index| {
                    const obj = try self.exportComptimeValue(element);
                    try host.setSlotValue(slots, index, obj);
                },
                .@"struct" => |st| inline for (st.fields, 0..) |field, index| {
                    const field_td = tdb.get(field.type);
                    if (field_td.isComptimeOnly()) {
                        const field_value = @field(value, field.name);
                        const obj = try self.exportComptimeValue(field_value);
                        try host.setSlotValue(slots, index, obj);
                    }
                },
                .@"union" => |un| if (un.tag_type) |Tag| {
                    const tag: Tag = value;
                    inline for (un.fields, 0..) |field, index| {
                        if (@field(Tag, field.name) == tag) {
                            const field_td = tdb.get(field.type);
                            if (field_td.isComptimeOnly()) {
                                const field_value = @field(value, field.name);
                                const obj = try self.exportComptimeValue(field_value);
                                try host.setSlotValue(slots, index, obj);
                            }
                        }
                    }
                } else {
                    @compileError("Unable to handle comptime value in bare union");
                },
                else => {},
            }
            return slots;
        }

        fn createObject(initializers: anytype) !Value {
            const object = try host.createObject();
            try setProperties(object, initializers);
            return object;
        }

        fn setProperties(object: Value, initializers: anytype) !void {
            inline for (std.meta.fields(@TypeOf(initializers))) |field| {
                if (try createValue(@field(initializers, field.name))) |value| {
                    try host.setProperty(object, field.name, value);
                }
            }
        }

        fn createList(initializers: anytype) !Value {
            const list = try host.createList();
            inline for (initializers) |initializer| {
                try appendList(list, initializer);
            }
            return list;
        }

        fn appendList(list: Value, initializer: anytype) !void {
            if (try createValue(initializer)) |value| {
                try host.appendList(list, value);
            }
        }

        fn createValue(initializer: anytype) !?Value {
            const T = @TypeOf(initializer);
            return switch (@typeInfo(T)) {
                .bool => try host.createBool(initializer),
                .int => |int| if (T == usize)
                    createValue(@as(u32, @intCast(initializer)))
                else switch (int.bits) {
                    32 => try host.createInteger(@bitCast(initializer), int.signedness == .unsigned),
                    64 => try host.createBigInteger(@bitCast(initializer), int.signedness == .unsigned),
                    else => try host.createInteger(@intCast(initializer), int.signedness == .unsigned),
                },
                .comptime_int => try createValue(@as(util.IntFor(initializer), initializer)),
                .@"enum" => try createValue(@intFromEnum(initializer)),
                .pointer => switch (T) {
                    Value => initializer,
                    []const u8, [:0]const u8 => try host.createString(initializer),
                    else => {
                        @compileLog(T);
                        @compileError("Unhandled pointer type");
                    },
                },
                .optional => if (initializer) |v| try createValue(v) else null,
                .@"struct" => |st| switch (st.layout) {
                    .@"packed" => try createValue(@as(st.backing_integer.?, @bitCast(initializer))),
                    else => try createObject(initializer),
                },
                .null => null,
                else => {
                    @compileLog(T);
                    @compileError("Unhandled type");
                },
            };
        }

        fn createView(ptr: anytype, copying: bool, export_handle: anytype) !Value {
            const PtrT = @TypeOf(ptr);
            const pt = @typeInfo(PtrT).pointer;
            const child_size = switch (@typeInfo(pt.child)) {
                .@"fn" => 0,
                else => @sizeOf(pt.child),
            };
            const address = switch (pt.size) {
                .slice => @intFromPtr(ptr.ptr),
                else => @intFromPtr(ptr),
            };
            const invalid_address = create: {
                var invalid_ptr: *u8 = undefined;
                _ = &invalid_ptr;
                break :create @intFromPtr(invalid_ptr);
            };
            if (address == invalid_address) {
                return host.createView(null, 0, copying, export_handle);
            }
            const len: usize = switch (pt.size) {
                .one => child_size,
                .slice => child_size * ptr.len,
                .many, .c => get: {
                    if (address != 0) {
                        if (pt.sentinel_ptr) |opaque_ptr| {
                            const sentinel_ptr: *const pt.child = @ptrCast(@alignCast(opaque_ptr));
                            var len: usize = 0;
                            while (ptr[len] != sentinel_ptr.*) {
                                len += 1;
                            }
                            break :get (len + 1) * child_size;
                        } else {
                            break :get 1;
                        }
                    } else {
                        break :get 0;
                    }
                },
            };
            const bytes: [*]const u8 = @ptrFromInt(address);
            return host.createView(bytes, len, copying, export_handle);
        }

        fn createInstance(structure: Value, ptr: anytype, copying: bool, export_handle: anytype, slots: ?Value) !Value {
            // export_handle is  null for WebAssembly, since addresses don't change there
            const dv = try createView(ptr, copying, export_handle);
            return host.createInstance(structure, dv, slots);
        }
    };
}

pub fn getFactoryThunk(comptime host: type, comptime module: type) zig_fn.Thunk {
    const ns = struct {
        fn exportStructures(_: *const anyopaque, _: *anyopaque) anyerror!void {
            @setEvalBranchQuota(options.eval_branch_quota);
            const factory: Factory(host, module) = .{};
            _ = try factory.getStructure(module);
            return;
        }
    };
    return ns.exportStructures;
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
                    .default_value_ptr = null,
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

fn readModifier(comptime modifier: ?type, comptime key: []const u8, comptime def: anytype) @TypeOf(def) {
    if (modifier) |T| {
        if (@hasField(T, key)) {
            const m: T = .{};
            return @field(m, key);
        }
    }
    return def;
}

const StructureType = enum(u32) {
    primitive = 0,
    array,
    @"struct",
    @"union",
    error_union,
    error_set,
    @"enum",
    optional,
    pointer,
    slice,
    vector,
    @"opaque",
    arg_struct,
    variadic_struct,
    function,
};

const StructurePurpose = enum(u32) {
    unknown,
    promise,
    generator,
    abort_signal,
    allocator,
    iterator,
    file,
    directory,

    pub fn isOptional(self: @This()) bool {
        return switch (self) {
            .promise, .generator, .abort_signal, .allocator => true,
            else => false,
        };
    }
};

const StructureFlags = struct {
    pub const Primitive = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_size: bool = false,
        _: u26 = 0,
    };
    pub const Array = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = true,
        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        _: u23 = 0,
    };
    pub const Struct = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_extern: bool = false,
        is_packed: bool = false,
        is_tuple: bool = false,
        is_optional: bool = false,
        _: u23 = 0,
    };
    pub const Union = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        has_selector: bool = false,
        has_tag: bool = false,
        has_inaccessible: bool = false,
        is_extern: bool = false,
        is_packed: bool = false,
        _: u22 = 0,
    };
    pub const ErrorUnion = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        _: u27 = 0,
    };
    pub const ErrorSet = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_global: bool = false,
        _: u26 = 0,
    };
    pub const Enum = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_open_ended: bool = false,
        _: u26 = 0,
    };
    pub const Optional = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        has_selector: bool = false,
        _: u26 = 0,
    };
    pub const Pointer = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,
        has_proxy: bool = true,
        has_length: bool = false,
        is_multiple: bool = false,
        is_single: bool = false,
        is_const: bool = false,
        is_nullable: bool = false,
        _: u22 = 0,
    };
    pub const Slice = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = true,
        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        is_opaque: bool = false,
        _: u22 = 0,
    };
    pub const Vector = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        _: u25 = 0,
    };
    pub const Opaque = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        _: u27 = 0,
    };
    pub const ArgStruct = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,
        has_proxy: bool = false,
        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u24 = 0,
    };
    pub const VariadicStruct = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,
        has_proxy: bool = false,
        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u24 = 0,
    };
    pub const Function = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        _: u27 = 0,
    };
};

const MemberType = enum(u32) {
    void = 0,
    bool,
    int,
    uint,
    float,
    object,
    type,
    literal,
    null,
    undefined,
    unsupported,
};

const MemberFlags = packed struct(u32) {
    is_required: bool = false,
    is_read_only: bool = false,
    is_part_of_set: bool = false,
    is_selector: bool = false,
    is_method: bool = false,
    is_expecting_instance: bool = false,
    is_sentinel: bool = false,
    is_backing_int: bool = false,
    is_string: bool = false,
    is_plain: bool = false,
    is_typed_array: bool = false,
    is_clamped_array: bool = false,
    _: u20 = 0,
};
