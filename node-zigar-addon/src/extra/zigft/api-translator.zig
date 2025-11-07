const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;
const expectEqualSlices = std.testing.expectEqualSlices;

const fn_transform = @import("./fn-transform.zig");

pub const EnumInfo = struct {
    name: []const u8,
    tag_type: []const u8,
    is_packed_struct: bool = false,
};
pub const InvalidValue = struct {
    err_value: []const u8,
    err_name: []const u8,
};
pub const CodeGeneratorOptions = struct {
    defines: []const []const u8 = &.{},
    include_paths: []const []const u8,
    header_paths: []const []const u8,
    zigft_path: []const u8 = "",
    translater: []const u8 = "c_to_zig",
    error_set: []const u8 = "Error",
    error_enum: ?[]const u8 = null,
    c_error_type: ?[]const u8 = null,
    c_import: []const u8 = "c",
    c_root_struct: ?[]const u8 = null,
    add_simple_test: bool = true,
    late_bind_expr: ?[]const u8 = null,
    ignore_omission: bool = false,

    // callback determining which declarations to include
    filter_fn: fn (name: []const u8) bool,

    param_override_fn: fn (fn_name: []const u8, param_name: ?[]const u8, param_index: usize, param_type: []const u8) ?[]const u8 = noParamOverride,
    retval_override_fn: fn (fn_name: []const u8, param_type: []const u8) ?[]const u8 = noRetvalOverride,
    field_override_fn: fn (container_name: []const u8, field_name: []const u8, param_type: []const u8) ?[]const u8 = noFieldOverride,

    invalid_value_fn: fn (type_name: []const u8) ?InvalidValue = ifOptionalPointer,

    // callback determining to const pointer to struct should become by-value
    type_is_by_value_fn: fn (type_name: []const u8) bool = neverByValue,

    // callback determining which enum items represent errors
    enum_is_error_fn: fn (item_name: []const u8, value: i128) bool = isNonZero,
    // callback determining if an enum type is a packed struct
    enum_is_packed_struct_fn: fn (enum_name: []const u8) bool = neverPackedStruct,

    // callbacks determining particular pointer attributes
    ptr_is_many_fn: fn (ptr_type: []const u8, child_type: []const u8) bool = isTargetChar,
    ptr_is_null_terminated_fn: fn (ptr_type: []const u8, child_type: []const u8) bool = isTargetChar,
    ptr_is_optional_fn: fn (ptr_type: []const u8, child_type: []const u8) bool = neverOptional,
    ptr_is_input_fn: fn (ptr_type: []const u8, child_type: []const u8) bool = neverInputPtr,

    // callback determining whether ptr param is optional
    param_is_optional_fn: fn (fn_name: []const u8, param_name: ?[]const u8, param_index: usize, param_type: []const u8) ?bool = notFunctionSpecific,
    // callback distinguishing in/out pointers from output pointers
    param_is_input_fn: fn (fn_name: []const u8, param_name: ?[]const u8, param_index: usize, param_type: []const u8) bool = neverInput,
    // callback returning the index of the corresponding pointer argument if it should be treated as the length of a slice pointer
    param_is_slice_len_fn: fn (fn_name: []const u8, param_name: ?[]const u8, param_index: usize, param_type: []const u8) ?usize = neverSliceLength,

    // callback for converting constants into enum and packed struct
    const_is_enum_item_fn: fn (const_name: []const u8) ?EnumInfo = notEnumItem,

    // calling determining whether positive status is needed
    status_is_returned_fn: fn (fn_name: []const u8) bool = neverReturned,
    // calling determining whether a fucntion returns an error union
    error_union_is_returned_fn: fn (fn_name: []const u8) bool = alwaysReturned,

    // callbacks adjusting naming convention
    fn_name_fn: fn (std.mem.Allocator, name: []const u8) std.mem.Allocator.Error![]const u8 = makeNoChange,
    type_name_fn: fn (std.mem.Allocator, name: []const u8) std.mem.Allocator.Error![]const u8 = makeNoChange,
    const_name_fn: fn (std.mem.Allocator, name: []const u8) std.mem.Allocator.Error![]const u8 = makeNoChange,
    param_name_fn: fn (std.mem.Allocator, name: []const u8) std.mem.Allocator.Error![]const u8 = removeArgPrefix,
    field_name_fn: fn (std.mem.Allocator, name: []const u8) std.mem.Allocator.Error![]const u8 = makeNoChange,
    enum_name_fn: fn (std.mem.Allocator, name: []const u8) std.mem.Allocator.Error![]const u8 = makeNoChange,
    error_name_fn: fn (std.mem.Allocator, name: []const u8) std.mem.Allocator.Error![]const u8 = makeNoChange,

    // callback returning doc comment
    doc_comment_fn: fn (std.mem.Allocator, old_name: []const u8, new_name: []const u8) std.mem.Allocator.Error!?[]const u8 = provideNoComment,
};

pub const inout = TypeWithAttributes.inout;

pub const TypeWithAttributes = struct {
    type: type,
    is_inout: bool = false,

    fn inout(comptime T: type) @This() {
        return .{ .type = T, .is_inout = true };
    }

    fn get(comptime arg: anytype) @This() {
        return switch (@TypeOf(arg)) {
            type => .{ .type = arg },
            @This() => arg,
            else => @compileError("Type expected, found  '" ++ @typeName(@TypeOf(arg)) ++ "'"),
        };
    }
};
pub const TypeSubstitution = struct {
    old: type,
    new: type,
};
pub const TranslatorOptions = struct {
    substitutions: []const TypeSubstitution = &.{},
    c_import_ns: type,
    late_bind_fn: ?fn ([:0]const u8) *const anyopaque = null,
    error_scheme: type = NullErrorScheme,
};
pub fn BasicErrorScheme(
    old_enum_type: type,
    new_error_set: type,
    default_error: new_error_set,
    invalid_values: anytype,
) type {
    @setEvalBranchQuota(2000000);
    const es_info = @typeInfo(new_error_set);
    if (es_info != .error_set) @compileError("Error set expected, found '" ++ @typeName(new_error_set) ++ "'");
    const en_info = @typeInfo(old_enum_type);
    const en_count = switch (en_info) {
        .@"enum" => |en| en.fields.len,
        .int, .bool, .void => 1,
        else => @compileError("Enum, int, bool, or void expected, found '" ++ @typeName(old_enum_type) ++ "'"),
    };
    const error_set = es_info.error_set orelse &.{};
    var error_enum_buffer: [error_set.len]struct {
        status: old_enum_type,
        err: new_error_set,
    } = undefined;
    var signatures: [error_set.len]comptime_int = undefined;
    for (error_set, 0..) |e, index| {
        error_enum_buffer[index].err = @field(new_error_set, e.name);
        signatures[index] = asComptimeInt(e.name);
    }
    var non_error_status_buffer: [en_count]old_enum_type = undefined;
    var non_error_status_count = 0;
    switch (en_info) {
        .@"enum" => |en| {
            for (en.fields) |field| {
                const status = @field(old_enum_type, field.name);
                const sig = asComptimeInt(field.name);
                if (std.mem.indexOfScalar(comptime_int, &signatures, sig)) |i| {
                    error_enum_buffer[i].status = status;
                } else {
                    non_error_status_buffer[non_error_status_count] = status;
                    non_error_status_count += 1;
                }
            }
            if (non_error_status_count == 0) @compileError("No success status");
        },
        .int => {
            error_enum_buffer[0].status = 1;
            non_error_status_buffer[0] = 0;
            non_error_status_count += 1;
        },
        .bool => {
            error_enum_buffer[0].status = false;
            non_error_status_buffer[0] = true;
            non_error_status_count += 1;
        },
        .void => {
            non_error_status_buffer[0] = {};
            non_error_status_count += 1;
        },
        else => unreachable,
    }
    const non_error_statuses = init: {
        var list: [non_error_status_count]old_enum_type = undefined;
        @memcpy(&list, non_error_status_buffer[0..non_error_status_count]);
        break :init list;
    };
    const error_enum_table = error_enum_buffer;
    return struct {
        pub const Status = old_enum_type;
        pub const ErrorSet = new_error_set;

        pub fn IntermediateReturnType(comptime T: type) type {
            return inline for (invalid_values) |iv| {
                if (iv.type == T) {
                    break if (@typeInfo(iv.type) == .pointer) ?iv.type else iv.type;
                }
            } else if (!isStatus(T)) T else Status;
        }

        fn isStatus(comptime T: type) bool {
            if (T == Status) return true;
            return switch (@typeInfo(Status)) {
                .@"enum" => |en| en.tag_type == T,
                else => false,
            };
        }

        pub fn OutputType(comptime T: type) type {
            return inline for (invalid_values) |iv| {
                if (@typeInfo(iv.type) == .pointer) {
                    if (T == ?iv.type) break iv.type;
                } else {
                    if (T == iv.type) break iv.type;
                }
            } else if (!isStatus(T)) T else switch (non_error_statuses.len) {
                0, 1 => void,
                else => Status,
            };
        }

        pub fn check(retval: anytype) ErrorSet!OutputType(@TypeOf(retval)) {
            const T = @TypeOf(retval);
            return inline for (invalid_values) |iv| {
                // check invalid value table first
                if (@typeInfo(iv.type) == .pointer) {
                    if (T == ?iv.type) {
                        break if (retval == iv.err_value) iv.err else retval.?;
                    }
                } else {
                    if (T == iv.type) {
                        break if (retval == iv.err_value) iv.err else retval;
                    }
                }
            } else switch (T) {
                // then see if retval is an error code
                Status => if (std.mem.indexOfScalar(Status, &non_error_statuses, retval)) |_|
                    if (OutputType(T) == void) {} else retval
                else for (error_enum_table) |entry| {
                    if (entry.status == retval) break entry.err;
                } else default_error,
                else => retval,
            };
        }
    };
}
pub const NullErrorScheme = struct {
    pub fn IntermediateReturnType(comptime T: type) type {
        return T;
    }
};

fn getBindNamespace(comptime fn_name: [:0]const u8, comptime FT: type) type {
    return struct {
        const name = fn_name;
        var func_ptr: ?*const FT = null;
    };
}

pub fn Translator(comptime options: TranslatorOptions) type {
    return struct {
        pub fn Translated(
            comptime OldFn: type,
            comptime return_error_union: bool,
            comptime ignore_non_error_return_value: bool,
            comptime local_subs: anytype,
        ) type {
            @setEvalBranchQuota(2000000);
            const old_fn = @typeInfo(OldFn).@"fn";
            const OldRT = old_fn.return_type.?;
            // Note: NewRT is not the new function's return type; it's just the old function's
            // return type translated
            const NewRT = Substitute(OldRT, local_subs, null, 0);
            const extra = switch (ignore_non_error_return_value) {
                true => 0,
                false => switch (return_error_union) {
                    // room for an extra type when there're multiple status codes indicating success
                    true => if (options.error_scheme.OutputType(NewRT) != void) 1 else 0,
                    // room for an extra type when the return value isn't an error code or void
                    false => if (NewRT != void) 1 else 0,
                },
            };
            // look for non-const pointers, scanning backward
            const OutputTypes = init: {
                var types: [old_fn.params.len + extra]type = undefined;
                if (extra == 1) {
                    types[old_fn.params.len] = if (return_error_union)
                        options.error_scheme.OutputType(NewRT)
                    else
                        NewRT;
                }
                const start_index = inline for (0..old_fn.params.len) |j| {
                    const i = old_fn.params.len - j - 1;
                    const Target = WritableTarget(old_fn.params[i].type.?) orelse break i + 1;
                    // see if the pointer is attributed as in/out
                    if (getTypeWithAttributes(local_subs, i, old_fn.params.len)) |type_wa| {
                        if (type_wa.is_inout) break i + 1;
                    }
                    types[i] = Substitute(Target, local_subs, i, old_fn.params.len);
                } else 0;
                break :init types[start_index..];
            };
            const param_count = old_fn.params.len + extra - OutputTypes.len;
            var params: [param_count]std.builtin.Type.Fn.Param = undefined;
            inline for (old_fn.params, 0..) |param, index| {
                if (index < param_count) {
                    params[index] = .{
                        .type = Substitute(param.type.?, local_subs, index, old_fn.params.len),
                        .is_generic = false,
                        .is_noalias = false,
                    };
                }
            }
            // determine the payload of the return type
            const Payload = switch (OutputTypes.len) {
                0 => void,
                1 => OutputTypes[0],
                else => std.meta.Tuple(OutputTypes),
            };
            return @Type(.{
                .@"fn" = .{
                    .calling_convention = .auto,
                    .is_generic = false,
                    .is_var_args = false,
                    .return_type = switch (return_error_union) {
                        true => options.error_scheme.ErrorSet!Payload,
                        else => Payload,
                    },
                    .params = &params,
                },
            });
        }

        pub fn translate(
            comptime fn_name: [:0]const u8,
            comptime return_error_union: bool,
            comptime ignore_non_error_return_value: bool,
            comptime local_subs: anytype,
        ) Translated(
            @TypeOf(@field(options.c_import_ns, fn_name)),
            return_error_union,
            ignore_non_error_return_value,
            local_subs,
        ) {
            @setEvalBranchQuota(2000000);
            const OldFn = @TypeOf(@field(options.c_import_ns, fn_name));
            const NewFn = Translated(
                OldFn,
                return_error_union,
                ignore_non_error_return_value,
                local_subs,
            );
            const OldRT = @typeInfo(OldFn).@"fn".return_type.?;
            // NewRT is OldRT in the new namespace (usually an enum)
            const NewRT = Substitute(OldRT, local_subs, null, 0);
            // ReturnType is what the new function actually returns
            const ReturnType = @typeInfo(NewFn).@"fn".return_type.?;
            const Payload = switch (@typeInfo(ReturnType)) {
                .error_union => |eu| eu.payload,
                else => ReturnType,
            };
            const ns = struct {
                inline fn call(new_args: std.meta.ArgsTuple(NewFn)) ReturnType {
                    var old_args: std.meta.ArgsTuple(OldFn) = undefined;
                    // copy arguments
                    inline for (new_args, 0..) |new_arg, i| {
                        const ArgT = @TypeOf(old_args[i]);
                        old_args[i] = convert(ArgT, new_arg);
                    }
                    var payload: Payload = if (Payload == void) {} else undefined;
                    // see how many pointers and tuple fields there're
                    const pointer_count = old_args.len - new_args.len;
                    const output_count = switch (@typeInfo(Payload)) {
                        .@"struct" => |st| if (st.is_tuple) payload.len else 1,
                        .void => 0,
                        else => 1,
                    };
                    const extra = output_count - pointer_count;
                    // add pointers to result
                    switch (pointer_count) {
                        1 => old_args[new_args.len] = @ptrCast(&payload),
                        else => inline for (new_args.len..old_args.len) |i| {
                            const ArgT = @TypeOf(old_args[i]);
                            old_args[i] = convert(ArgT, &payload[i - new_args.len]);
                        },
                    }
                    // get original function
                    const func = if (options.late_bind_fn) |get| bind: {
                        const bind_ns = getBindNamespace(fn_name, OldFn);
                        if (bind_ns.func_ptr) |ptr| {
                            break :bind ptr;
                        } else {
                            const ptr: *const OldFn = @alignCast(@ptrCast(get(fn_name)));
                            bind_ns.func_ptr = ptr;
                            break :bind ptr;
                        }
                    } else @field(options.c_import_ns, fn_name);
                    // call original function
                    const old_rv = @call(.auto, func, old_args);
                    const IRT = switch (return_error_union) {
                        true => options.error_scheme.IntermediateReturnType(NewRT),
                        false => NewRT,
                    };
                    const new_rv = convert(IRT, old_rv);
                    // check outcome (if returning error union)
                    const output = switch (return_error_union) {
                        true => try options.error_scheme.check(new_rv),
                        false => new_rv,
                    };
                    if (extra > 0) {
                        // add positive status to result
                        if (output_count > 1)
                            payload[payload.len - 1] = output
                        else
                            payload = output;
                    }
                    return payload;
                }
            };
            return fn_transform.spreadArgs(ns.call, .auto);
        }

        pub fn SliceType(comptime T: type) type {
            return switch (@typeInfo(T)) {
                .pointer => |pt| define: {
                    var new_pt = pt;
                    new_pt.size = .slice;
                    new_pt.sentinel_ptr = null;
                    if (@typeInfo(new_pt.child) == .@"opaque") new_pt.child = u8;
                    break :define @Type(.{ .pointer = new_pt });
                },
                .optional => |op| ?SliceType(op.child),
                else => @compileError("Argument is not a pointer"),
            };
        }

        pub fn SliceMerged(
            comptime OldFn: type,
            comptime pairs: []const SplitSlice,
        ) type {
            @setEvalBranchQuota(2000000);
            const old_fn = switch (@typeInfo(OldFn)) {
                .@"fn" => |f| f,
                else => @compileError("Function type expected, received '" ++ @typeName(OldFn) ++ "'"),
            };
            const param_count = old_fn.params.len - pairs.len;
            var new_params: [param_count]std.builtin.Type.Fn.Param = undefined;
            var j: usize = 0;
            inline for (old_fn.params, 0..) |param, i| {
                const PT = param.type orelse @compileError("Cannot merge generic argument");
                const is_index = inline for (pairs) |pair| {
                    if (pair.len_index == i) break true;
                } else false;
                if (!is_index) {
                    new_params[j] = param;
                    const is_ptr = inline for (pairs) |pair| {
                        if (pair.ptr_index == i) break true;
                    } else false;
                    if (is_ptr) new_params[j].type = SliceType(PT);
                    j += 1;
                } else {
                    switch (@typeInfo(PT)) {
                        .int => {},
                        else => @compileError("Argument is not an integer"),
                    }
                }
            }
            var new_fn = old_fn;
            new_fn.params = &new_params;
            return @Type(.{ .@"fn" = new_fn });
        }

        pub fn mergeSlice(
            comptime func: anytype,
            comptime pairs: []const SplitSlice,
        ) SliceMerged(@TypeOf(func), pairs) {
            @setEvalBranchQuota(2000000);
            const OldFn = @TypeOf(func);
            const NewFn = SliceMerged(OldFn, pairs);
            const NewRT = @typeInfo(NewFn).@"fn".return_type.?;
            const cc = @typeInfo(NewFn).@"fn".calling_convention;
            const ns = struct {
                fn call(new_args: std.meta.ArgsTuple(NewFn)) NewRT {
                    var old_args: std.meta.ArgsTuple(OldFn) = undefined;
                    // copy arguments
                    comptime var j: usize = 0;
                    inline for (0..old_args.len) |i| {
                        const is_index = inline for (pairs) |pair| {
                            if (pair.len_index == i) break true;
                        } else false;
                        if (!is_index) {
                            // see if it's a slice pointer
                            const len_index: ?usize = inline for (pairs) |pair| {
                                if (pair.ptr_index == i) break pair.len_index;
                            } else null;
                            if (len_index) |k| {
                                // copy len and pointer
                                const new_arg = new_args[j];
                                const AT = @TypeOf(new_arg);
                                switch (@typeInfo(AT)) {
                                    .pointer => {
                                        old_args[i] = @ptrCast(new_arg.ptr);
                                        old_args[k] = @intCast(new_arg.len);
                                    },
                                    .optional => {
                                        if (new_arg) |s| {
                                            old_args[i] = @ptrCast(s.ptr);
                                            old_args[k] = @intCast(s.len);
                                        } else {
                                            old_args[i] = null;
                                            old_args[k] = 0;
                                        }
                                    },
                                    else => unreachable,
                                }
                            } else {
                                old_args[i] = new_args[j];
                            }
                            j += 1;
                        }
                    }
                    // call original function
                    return @call(.always_inline, func, old_args);
                }
            };
            return fn_transform.spreadArgs(ns.call, cc);
        }

        pub fn translateMerge(
            comptime fn_name: [:0]const u8,
            comptime return_error_union: bool,
            comptime ignore_non_error_return_value: bool,
            comptime local_subs: anytype,
            comptime pairs: []const SplitSlice,
        ) SliceMerged(Translated(
            @TypeOf(@field(options.c_import_ns, fn_name)),
            return_error_union,
            ignore_non_error_return_value,
            local_subs,
        ), pairs) {
            const f = translate(fn_name, return_error_union, ignore_non_error_return_value, local_subs);
            return mergeSlice(f, pairs);
        }

        inline fn convert(comptime T: type, arg: anytype) T {
            const AT = @TypeOf(arg);
            return switch (@typeInfo(T)) {
                .int => switch (@typeInfo(AT)) {
                    .@"enum" => @intFromEnum(arg),
                    .bool => if (arg) 1 else 0,
                    else => @bitCast(arg),
                },
                .pointer => switch (@typeInfo(AT)) {
                    .pointer => @ptrCast(arg),
                    .optional => if (arg) |a| convert(T, a) else switch (@typeInfo(T)) {
                        .optional => null,
                        .pointer => |pt| if (pt.is_allowzero) null else @panic("Unexpected null pointer"),
                        else => @panic("Unexpected null pointer"),
                    },
                    // converting "pass-by-value" to "pass-by-pointer"
                    else => convert(T, &arg),
                },
                inline .@"struct", .@"union" => switch (@typeInfo(AT)) {
                    .pointer => convert(T, arg.*),
                    else => @bitCast(arg),
                },
                .optional => |op| switch (@typeInfo(AT)) {
                    .optional => if (arg) |a| convert(op.child, a) else null,
                    .pointer => |pt| switch (pt.is_allowzero and arg == null) {
                        false => convert(op.child, arg),
                        true => null,
                    },
                    else => convert(op.child, arg),
                },
                .@"enum" => @enumFromInt(arg),
                .void => arg,
                else => @bitCast(arg),
            };
        }

        fn SwapType(comptime T: type, comptime dir: enum { old_to_new, new_to_old }) type {
            return inline for (options.substitutions) |sub| {
                if (dir == .old_to_new) {
                    if (T == sub.old) break sub.new;
                } else {
                    if (T == sub.new) break sub.old;
                }
            } else T;
        }

        fn getTypeWithAttributes(tuple: anytype, arg_index: ?usize, arg_count: usize) ?TypeWithAttributes {
            const keys = if (arg_index) |index| .{
                std.fmt.comptimePrint("{d}", .{index}),
                std.fmt.comptimePrint("{d}", .{-@as(isize, @intCast(arg_count - index))}),
            } else .{"retval"};
            return inline for (keys) |key| {
                if (@hasField(@TypeOf(tuple), key)) {
                    break TypeWithAttributes.get(@field(tuple, key));
                }
            } else null;
        }

        fn Substitute(comptime T: type, tuple: anytype, arg_index: ?usize, arg_count: usize) type {
            // look for type in function-specific tuple first
            return if (getTypeWithAttributes(tuple, arg_index, arg_count)) |type_wa|
                type_wa.type
            else
                SwapType(T, .old_to_new);
        }

        fn WritableTarget(comptime T: type) ?type {
            const info = @typeInfo(T);
            if (info == .pointer and !info.pointer.is_const) {
                const Target = info.pointer.child;
                if (@typeInfo(Target) != .@"opaque" and @sizeOf(Target) != 0) return Target;
            }
            return null;
        }
    };
}

pub const Expression = union(enum) {
    identifier: []const u8,
    empty: void,
    any: []const u8,
    type: Type,
    array_init: ArrayInit,
    struct_init: StructInit,
    function_call: FunctionCall,
    function_body: []const u8,
    reference_to: *const Expression,

    pub const Type = union(enum) {
        container: Container,
        pointer: Pointer,
        enumeration: Enumeration,
        function: Function,
        error_union: ErrorUnion,
        error_set: ErrorSet,
        optional: Optional,

        pub const Container = struct {
            layout: ?[]const u8 = null,
            backing_type: ?[]const u8 = null,
            kind: []const u8,
            fields: []Field = &.{},
            decls: []Declaration = &.{},
        };
        pub const Pointer = struct {
            child_type: *const Expression,
            alignment: ?[]const u8,
            sentinel: ?[]const u8,
            size: std.builtin.Type.Pointer.Size,
            is_const: bool,
            is_volatile: bool,
            allows_zero: bool,
        };
        pub const Enumeration = struct {
            items: []EnumItem = &.{},
            tag_type: []const u8,
            is_exhaustive: bool = false,
        };
        pub const Function = struct {
            parameters: []Parameter = &.{},
            return_type: *const Expression,
            alignment: ?[]const u8,
            call_convention: ?[]const u8,
        };
        pub const ErrorUnion = struct {
            payload_type: *const Expression,
            error_set: *const Expression,
        };
        pub const ErrorSet = struct {
            names: [][]const u8,
        };
        pub const Optional = struct {
            child_type: *const Expression,
        };
        pub const Tag = @typeInfo(@This()).@"union".tag_type.?;
    };
    pub const ArrayInit = struct {
        initializers: []*const Expression,
        is_multiline: bool = false,
        is_reference: bool = false,
    };
    pub const StructInit = struct {
        type: ?*const Expression = null,
        initializers: []const Initializer,
        is_multiline: bool = false,

        pub const Initializer = struct {
            name: []const u8,
            value: *const Expression,
        };
    };
    pub const FunctionCall = struct {
        fn_ref: *const Expression,
        arguments: []*const Expression,
    };
    pub const Tag = @typeInfo(@This()).@"union".tag_type.?;
};
pub const Field = struct {
    name: []const u8,
    type: *const Expression,
    alignment: ?[]const u8 = null,
    default_value: ?[]const u8 = null,
};
pub const Declaration = struct {
    public: bool = true,
    name: []const u8,
    type: ?*const Expression = null,
    alignment: ?[]const u8 = null,
    extern_export: ?[]const u8 = null,
    mutable: bool = false,
    expr: *const Expression,
    doc_comment: ?[]const u8 = null,
};
pub const Parameter = struct {
    type: *const Expression,
    name: ?[]const u8 = null,
    is_inout: bool = false,
};
pub const EnumItem = struct {
    name: []const u8,
    value: i128,
};
pub const NamespaceType = enum { old, new };
pub const Namespace = struct {
    to_expr: std.StringHashMap(*const Expression),
    to_name: std.AutoHashMap(*const Expression, []const u8),

    pub fn init(allocator: std.mem.Allocator) @This() {
        return .{
            .to_expr = .init(allocator),
            .to_name = .init(allocator),
        };
    }

    pub fn getExpression(self: *const @This(), name: []const u8) ?*const Expression {
        return self.to_expr.get(name);
    }

    pub fn getName(self: *const @This(), expr: *const Expression) ?[]const u8 {
        return self.to_name.get(expr);
    }

    pub fn addExpression(self: *@This(), name: []const u8, expr: *const Expression) !void {
        try self.to_expr.put(name, expr);
        if (self.to_name.get(expr) == null)
            try self.to_name.put(expr, name);
    }

    pub fn removeExpression(self: *@This(), expr: *const Expression) void {
        if (self.to_name.get(expr)) |name| {
            _ = self.to_expr.remove(name);
            _ = self.to_name.remove(expr);
        }
    }
};
const SplitSlice = struct {
    len_index: usize,
    ptr_index: usize,
};
const LocalSubstitution = struct {
    index: ?usize,
    type: *const Expression,
};

pub fn CodeGenerator(comptime options: CodeGeneratorOptions) type {
    return struct {
        const Ast = std.zig.Ast;
        const NameContext = enum {
            @"fn",
            type,
            @"const",
            param,
            field,
            @"enum",
            @"error",
        };
        const Substitution = struct {
            old_type: *const Expression,
            new_type: *const Expression,
            is_inout: bool = false,
        };

        arena: std.heap.ArenaAllocator,
        allocator: std.mem.Allocator,
        cwd: []const u8,
        indent_level: usize,
        indented: bool,
        close_bracket_stack: std.ArrayList([]const u8),
        old_root: *Expression,
        old_namespace: Namespace,
        old_to_new_map: std.AutoHashMap(*const Expression, *const Expression),
        new_root: *Expression,
        new_namespace: Namespace,
        new_error_set: *const Expression,
        non_error_enum_count: usize,
        anonymous_type_count: usize,
        current_root: *const Expression,
        write_to_byte_array: bool,
        byte_array: std.ArrayList(u8),
        output_writer: std.io.AnyWriter,
        need_inout_import: bool,
        add_child_type: bool,
        new_root_original_type: ?*const Expression,
        invalid_value_map: std.AutoHashMap(*const Expression, InvalidValue),
        return_error_map: std.AutoHashMap(*const Expression, bool),

        pub fn init(allocator: std.mem.Allocator) !*@This() {
            var arena: std.heap.ArenaAllocator = .init(allocator);
            var self = try arena.allocator().create(@This());
            self.arena = arena;
            self.allocator = self.arena.allocator();
            self.cwd = try std.process.getCwdAlloc(self.allocator);
            self.indent_level = 0;
            self.indented = false;
            self.close_bracket_stack = .init(self.allocator);
            self.old_root = try self.createType(.{
                .container = .{ .kind = "struct" },
            });
            self.old_namespace = .init(self.allocator);
            self.old_to_new_map = .init(self.allocator);
            self.new_root = try self.createType(.{
                .container = .{ .kind = "struct" },
            });
            self.current_root = self.new_root;
            self.new_namespace = .init(self.allocator);
            self.non_error_enum_count = 0;
            self.anonymous_type_count = 0;
            self.write_to_byte_array = false;
            self.byte_array = .init(self.allocator);
            self.need_inout_import = false;
            self.add_child_type = false;
            self.new_root_original_type = null;
            self.invalid_value_map = .init(self.allocator);
            self.return_error_map = .init(self.allocator);
            return self;
        }

        pub fn deinit(self: *@This()) void {
            var arena = self.arena;
            arena.deinit();
        }

        pub fn analyze(self: *@This()) !void {
            try self.processHeaderFiles();
            try self.translateDeclarations();
        }

        pub fn print(self: *@This(), writer: anytype) anyerror!void {
            self.output_writer = writer.any();
            self.add_child_type = true;
            try self.printImports();
            try self.printExpression(self.new_root, .new);
            if (options.add_simple_test) try self.printSimpleTest();
        }

        fn processHeaderFiles(self: *@This()) !void {
            for (options.header_paths) |path| {
                const full_path = try self.findSourceFile(path);
                const output = try self.translateHeaderFile(full_path);
                const source = try self.allocator.dupeZ(u8, output);
                const tree = try Ast.parse(self.allocator, source, .zig);
                for (tree.rootDecls()) |node| {
                    var buffer1: [1]Ast.Node.Index = undefined;
                    if (tree.fullFnProto(&buffer1, node)) |proto| {
                        try self.processFnProto(tree, proto);
                    } else if (tree.fullVarDecl(node)) |decl| {
                        try self.processVarDecl(tree, decl);
                    }
                }
            }
        }

        fn processFnProto(self: *@This(), tree: Ast, proto: Ast.full.FnProto) !void {
            if (proto.visib_token == null or proto.name_token == null) return;
            const fn_name = tree.tokenSlice(proto.name_token.?);
            const fn_type = try self.createExpression(.{
                .type = try self.obtainFunctionType(tree, proto),
            });
            try self.append(&self.old_root.type.container.decls, .{
                .name = fn_name,
                .type = fn_type,
                .expr = &.{ .function_body = "" },
            });
            try self.old_namespace.addExpression(fn_name, fn_type);
        }

        fn processVarDecl(self: *@This(), tree: Ast, decl: Ast.full.VarDecl) !void {
            if (decl.visib_token == null) return;
            const var_name = tree.tokenSlice(decl.ast.mut_token + 1);
            const var_type = switch (decl.ast.type_node) {
                0 => null,
                else => try self.obtainExpression(tree, decl.ast.type_node),
            };
            const expr = try self.obtainExpressionEx(tree, decl.ast.init_node, true);
            try self.append(&self.old_root.type.container.decls, .{
                .mutable = std.mem.eql(u8, "var", tree.tokenSlice(decl.ast.mut_token)),
                .extern_export = if (decl.extern_export_token) |t| tree.tokenSlice(t) else null,
                .name = var_name,
                .type = var_type,
                .alignment = nodeSlice(tree, decl.ast.align_node),
                .expr = expr,
            });
            try self.old_namespace.addExpression(var_name, expr);
        }

        fn obtainExpression(self: *@This(), tree: Ast, node: Ast.Node.Index) std.mem.Allocator.Error!*const Expression {
            return self.obtainExpressionEx(tree, node, false);
        }

        fn obtainExpressionEx(self: *@This(), tree: Ast, node: Ast.Node.Index, is_rhs: bool) !*const Expression {
            var buffer1: [1]Ast.Node.Index = undefined;
            var buffer2: [2]Ast.Node.Index = undefined;
            if (node == 0) return self.createExpression(.{ .empty = {} });
            const type_maybe = if (tree.fullFnProto(&buffer1, node)) |fn_proto|
                try self.obtainFunctionType(tree, fn_proto)
            else if (tree.fullContainerDecl(&buffer2, node)) |decl|
                try self.obtainContainerType(tree, decl)
            else if (tree.fullPtrType(node)) |ptr|
                try self.obtainPointerType(tree, ptr)
            else if (tree.nodes.items(.tag)[node] == .optional_type)
                try self.obtainOptionalType(tree, node)
            else if (self.detectEnumType(tree, node, is_rhs)) |e|
                try self.obtainEnumType(tree, e.item_count, e.is_signed)
            else
                null;
            return if (type_maybe) |t|
                self.createExpression(.{ .type = t })
            else if (tree.nodes.items(.tag)[node] == .identifier)
                self.createExpression(.{ .identifier = nodeSlice(tree, node).? })
            else
                self.createExpression(.{ .any = nodeSlice(tree, node).? });
        }

        fn obtainFunctionType(self: *@This(), tree: Ast, proto: Ast.full.FnProto) !Expression.Type {
            var params: []Parameter = &.{};
            for (proto.ast.params) |param| {
                // see if there's a colon in front of the param type
                const before = tree.tokenSlice(tree.firstToken(param) - 1);
                try self.append(&params, .{
                    .name = switch (std.mem.eql(u8, before, ":")) {
                        true => tree.tokenSlice(tree.firstToken(param) - 2),
                        false => null,
                    },
                    .type = try self.obtainExpression(tree, param),
                });
            }
            return .{
                .function = .{
                    .parameters = params,
                    .return_type = try self.obtainExpression(tree, proto.ast.return_type),
                    .alignment = nodeSlice(tree, proto.ast.align_expr),
                    .call_convention = nodeSlice(tree, proto.ast.callconv_expr),
                },
            };
        }

        fn obtainContainerType(self: *@This(), tree: Ast, decl: Ast.full.ContainerDecl) !Expression.Type {
            var fields: []Field = &.{};
            for (decl.ast.members) |member| {
                if (tree.fullContainerField(member)) |field| {
                    try self.append(&fields, .{
                        .name = tree.tokenSlice(field.ast.main_token),
                        .type = try self.obtainExpression(tree, field.ast.type_expr),
                        .alignment = nodeSlice(tree, field.ast.align_expr),
                    });
                }
            }
            return .{
                .container = .{
                    .layout = if (decl.layout_token) |t| tree.tokenSlice(t) else null,
                    .kind = tree.tokenSlice(decl.ast.main_token),
                    .fields = fields,
                },
            };
        }

        fn obtainPointerType(self: *@This(), tree: Ast, ptr_type: Ast.full.PtrType) !Expression.Type {
            return .{
                .pointer = .{
                    .child_type = try self.obtainExpression(tree, ptr_type.ast.child_type),
                    .sentinel = nodeSlice(tree, ptr_type.ast.sentinel),
                    .size = ptr_type.size,
                    .is_const = ptr_type.const_token != null,
                    .is_volatile = ptr_type.volatile_token != null,
                    .allows_zero = ptr_type.allowzero_token != null,
                    .alignment = nodeSlice(tree, ptr_type.ast.align_node),
                },
            };
        }

        fn obtainOptionalType(self: *@This(), tree: Ast, node: Ast.Node.Index) !Expression.Type {
            const data = tree.nodes.items(.data)[node];
            return .{
                .optional = .{
                    .child_type = try self.obtainExpression(tree, data.lhs),
                },
            };
        }

        fn obtainEnumType(self: *@This(), _: Ast, count: usize, is_signed: bool) !Expression.Type {
            // remove decls containing integers and use them as the enum values
            const index: usize = self.old_root.type.container.decls.len - count;
            var items: []EnumItem = &.{};
            for (0..count) |_| {
                const decl = self.old_root.type.container.decls[index];
                const value = std.fmt.parseInt(i128, decl.expr.any, 10) catch unreachable;
                try self.append(&items, .{ .name = decl.name, .value = value });
                self.remove(&self.old_root.type.container.decls, index);
            }
            return .{
                .enumeration = .{
                    .items = items,
                    .tag_type = if (is_signed) "c_int" else "c_uint",
                },
            };
        }

        fn detectEnumType(self: *@This(), tree: Ast, node: Ast.Node.Index, is_rhs: bool) ?struct {
            item_count: usize,
            is_signed: bool,
        } {
            if (!is_rhs) return null;
            // C enums get translated as either c_uint or c_int
            const rhs = nodeSlice(tree, node).?;
            const is_signed_int = std.mem.eql(u8, rhs, "c_int");
            const is_unsigned_int = std.mem.eql(u8, rhs, "c_uint");
            if (is_signed_int or is_unsigned_int) {
                // enum items are declared ahead of the type;
                // scan backward looking for int values
                const decls = self.old_root.type.container.decls;
                var count: usize = 0;
                while (count + 1 < decls.len) : (count += 1) {
                    const decl = decls[decls.len - count - 1];
                    if (!decl.mutable and decl.expr.* == .any) {
                        _ = std.fmt.parseInt(i128, decl.expr.any, 10) catch break;
                    } else break;
                }
                if (count > 0) return .{
                    .item_count = count,
                    .is_signed = is_signed_int,
                };
            }
            return null;
        }

        fn createExpression(self: *@This(), expr: Expression) !*Expression {
            const e = try self.allocator.create(Expression);
            e.* = expr;
            return e;
        }

        fn createIdentifier(self: *@This(), comptime fmt: []const u8, args: anytype) !*Expression {
            if (args.len > 0) {
                const name = try self.allocPrint(fmt, args);
                return self.createExpression(.{ .identifier = name });
            } else {
                return @constCast(&Expression{ .identifier = fmt });
            }
        }

        fn createCode(self: *@This(), comptime fmt: []const u8, args: anytype) !*Expression {
            if (args.len > 0) {
                const code = try self.allocPrint(fmt, args);
                return self.createExpression(.{ .any = code });
            } else {
                return @constCast(&Expression{ .any = fmt });
            }
        }

        fn createType(self: *@This(), type_info: Expression.Type) !*Expression {
            return self.createExpression(.{ .type = type_info });
        }

        fn nodeSlice(tree: Ast, node: Ast.Node.Index) ?[]const u8 {
            if (node == 0) return null;
            const span = tree.nodeToSpan(node);
            return tree.source[span.start..span.end];
        }

        fn transformName(self: *@This(), name: []const u8, context: NameContext) ![]const u8 {
            switch (context) {
                inline else => |tag| {
                    const f = @field(options, @tagName(tag) ++ "_name_fn");
                    const name_adj = if (std.mem.startsWith(u8, name, "@\"")) name[2 .. name.len - 1] else name;
                    const new_name = try f(self.allocator, name_adj);
                    if (std.mem.startsWith(u8, new_name, "@\"")) return new_name;
                    const is_valid = std.zig.isValidId(new_name) and switch (context) {
                        .@"const", .@"fn", .param, .type => !std.zig.primitives.isPrimitive(new_name),
                        else => true,
                    };
                    return if (is_valid) new_name else try self.allocPrint("@\"{s}\"", .{new_name});
                },
            }
        }

        fn translateDeclarations(self: *@This()) !void {
            // convert constants to enum
            var constant_map: std.StringHashMap(?*Expression) = .init(self.allocator);
            var packed_structs: std.ArrayList(*Expression) = .init(self.allocator);
            for (self.old_root.type.container.decls) |decl| {
                if (self.isTypeOf(decl.type, .function) or self.isType(decl.expr)) continue;
                const value = self.extractInteger(decl.expr) orelse continue;
                if (options.const_is_enum_item_fn(decl.name)) |enum_info| {
                    const enum_expr, const is_new_enum = get: {
                        if (self.new_namespace.getExpression(enum_info.name)) |expr| {
                            if (!self.isTypeOf(expr, .enumeration)) {
                                std.debug.print("'{s}' is not an enumeration type\n", .{enum_info.name});
                                return error.Unexpected;
                            }
                            break :get .{ @constCast(expr), false };
                        } else {
                            const expr = try self.createType(.{
                                .enumeration = .{
                                    .items = &.{},
                                    .tag_type = enum_info.tag_type,
                                },
                            });
                            try self.new_namespace.addExpression(enum_info.name, expr);
                            break :get .{ expr, true };
                        }
                    };
                    const item_name = try self.transformName(decl.name, .@"enum");
                    try self.append(&enum_expr.type.enumeration.items, .{
                        .name = item_name,
                        .value = value,
                    });
                    try constant_map.put(decl.name, if (is_new_enum) enum_expr else null);
                    if (is_new_enum and enum_info.is_packed_struct) {
                        // remember that the enum is actually a packed struct
                        try packed_structs.append(enum_expr);
                    }
                }
            }
            // convert enums to packed structs now that we have the complete sets of values
            for (packed_structs.items) |expr| {
                expr.type = .{ .container = try self.convertEnumToPackedStruct(expr.type.enumeration) };
            }
            // add error set first if functions return one
            const error_set, const non_error_count = try self.deriveErrorSet();
            try self.append(&self.new_root.type.container.decls, .{
                .name = options.error_set,
                .expr = error_set,
            });
            self.new_error_set = error_set;
            self.non_error_enum_count = non_error_count;
            try self.new_namespace.addExpression(options.error_set, error_set);

            // translate all declarations
            var new_name_map: std.StringHashMap(bool) = .init(self.allocator);
            for (self.old_root.type.container.decls) |decl| {
                if (constant_map.get(decl.name)) |outcome| {
                    // insert new enum type if decl is the first item
                    const enum_type = outcome orelse continue;
                    const new_name = self.new_namespace.getName(enum_type).?;
                    try new_name_map.put(new_name, true);
                    const doc_comment = try options.doc_comment_fn(self.allocator, decl.name, new_name);
                    try self.append(&self.new_root.type.container.decls, .{
                        .name = new_name,
                        .expr = enum_type,
                        .doc_comment = doc_comment,
                    });
                } else if (options.filter_fn(decl.name)) {
                    // skip if decl results in @compileError
                    if (decl.expr.* == .any) {
                        const code = decl.expr.any;
                        if (std.mem.containsAtLeast(u8, code, 1, "@compileError")) {
                            if (!options.ignore_omission) {
                                std.debug.print("Omitting '{s}' since it's defined as {s}\n", .{ decl.name, code });
                            }
                            continue;
                        }
                    }
                    // get name in target namespace
                    const transform: NameContext = if (self.isTypeOf(decl.type, .function))
                        .@"fn"
                    else if (self.isType(decl.expr))
                        .type
                    else
                        .@"const";
                    const new_name = try self.transformName(decl.name, transform);
                    if (new_name_map.get(new_name)) |_| continue;
                    try new_name_map.put(new_name, true);
                    const doc_comment = try options.doc_comment_fn(self.allocator, decl.name, new_name);
                    if (decl.extern_export) |e| {
                        if (std.mem.eql(u8, e, "extern")) {
                            try self.append(&self.new_root.type.container.decls, .{
                                .name = new_name,
                                .expr = try self.createExpression(.{ .reference_to = decl.expr }),
                                .doc_comment = doc_comment,
                            });
                        }
                        continue;
                    }
                    const new_type = if (decl.type) |t| try self.translateExpression(t) else null;
                    const expr = try self.translateDefinition(decl.expr);
                    try self.new_namespace.addExpression(new_name, expr);
                    try self.append(&self.new_root.type.container.decls, .{
                        .name = new_name,
                        .type = new_type,
                        .alignment = decl.alignment,
                        .expr = expr,
                        .doc_comment = doc_comment,
                    });
                }
            }
            if (options.c_root_struct) |name| {
                // use specified type as root (i.e. the namespace of the source file)
                const old_container = self.old_namespace.getExpression(name) orelse {
                    std.debug.print("Unable to find container type '{s}'\n", .{name});
                    return error.Unexpected;
                };
                const new_container = self.old_to_new_map.get(old_container) orelse return error.Unexpected;
                var new_root: *Expression = @constCast(new_container);
                if (self.getPointerInfo(new_root)) |p| {
                    new_root = @constCast(p.child_type);
                }
                if (!self.isTypeOf(new_root, .container)) {
                    try self.redefineAsContainer(new_root, name);
                }

                // transfer decls into specified type
                new_root.type.container.decls = self.new_root.type.container.decls;
                self.new_root = new_root;
                // remove declaration of root struct
                for (new_root.type.container.decls, 0..) |decl, i| {
                    if (decl.expr == new_root) {
                        self.remove(&new_root.type.container.decls, i);
                        break;
                    }
                }
                // remove pointer type from namespace (but keep the declaration), if used to specified the struct
                if (self.isPointer(new_container)) {
                    self.new_namespace.removeExpression(new_container);
                }
            }
            // look for global substitutions
            const global_subs = try self.findGlobalSubstutions();
            // add translate calls to function declarations
            for (self.new_root.type.container.decls) |*new_decl| {
                if (self.isTypeOf(new_decl.type, .function)) {
                    const new_type = new_decl.type.?;
                    const t, const fn_name = for (self.old_root.type.container.decls) |decl| {
                        if (self.isTypeOf(decl.type, .function)) {
                            if (self.old_to_new_map.get(decl.type.?) == new_type) {
                                break .{ decl.type.?, decl.name };
                            }
                        }
                    } else unreachable;
                    const return_error_union = try self.shouldReturnErrorUnion(fn_name, t);
                    const ignore_non_error_return_value = try self.shouldIgnoreNonErrorRetval(fn_name, t);
                    const local_subs = try self.findLocalSubstitutions(t, new_type, global_subs);
                    const split_slices = try self.findSplitSlices(t, new_type);
                    // get translate() or translateMerge() call
                    new_decl.expr = try self.obtainTranslateCall(
                        fn_name,
                        return_error_union,
                        ignore_non_error_return_value,
                        local_subs,
                        split_slices,
                    );
                    if (split_slices.len > 0) {
                        // change the declaration, removing slice len and changing pointer type
                        for (0..split_slices.len) |i| {
                            const pair = split_slices[split_slices.len - i - 1];
                            const func = @constCast(&new_type.type.function);
                            const ptr_param = &func.parameters[pair.ptr_index];
                            ptr_param.type = try self.translateSlicePointer(ptr_param.type);
                            self.remove(&func.parameters, pair.len_index);
                        }
                    }
                }
            }
            // add translator setup
            try self.append(&self.new_root.type.container.decls, .{
                .public = false,
                .name = options.translater,
                .expr = try self.obtainTranslatorSetup(global_subs),
            });
            // remove error set if it's not in use
            if (!self.isUsingErrorSet()) {
                self.remove(&self.new_root.type.container.decls, 0);
            }
        }

        fn translateDefinition(self: *@This(), expr: *const Expression) !*const Expression {
            if (expr.* == .identifier) {
                if (options.filter_fn(expr.identifier)) {
                    // don't dereference the identifier when it's imported into the new namespace
                    // in a situation where the same type appears under multiple name we want to
                    // retain the name used in that particular instance
                    const ref_expr = self.resolveType(expr, .old);
                    const context: NameContext = switch (ref_expr.*) {
                        .type => .type,
                        .function_body => .@"fn",
                        else => .@"const",
                    };
                    const new_name = try self.transformName(expr.identifier, context);
                    const new_expr = try self.createIdentifier("{s}", .{new_name});
                    try self.old_to_new_map.put(expr, new_expr);
                    return new_expr;
                }
            }
            return self.translateExpression(expr);
        }

        fn translateExpression(self: *@This(), expr: *const Expression) !*const Expression {
            return self.translateExpressionEx(expr, false);
        }

        const TranslateError = std.mem.Allocator.Error || error{Unexpected};

        fn translateExpressionEx(
            self: *@This(),
            expr: *const Expression,
            is_pointer_target: bool,
        ) TranslateError!*const Expression {
            if (self.old_to_new_map.get(expr)) |new_expr| {
                return new_expr;
            } else {
                switch (expr.*) {
                    .type => |t| {
                        const new_expr = try self.createExpression(.{ .empty = {} });
                        try self.old_to_new_map.put(expr, new_expr);
                        const new_type = switch (t) {
                            .container => try self.translateContainer(expr),
                            .pointer, .optional => try self.translatePointer(expr),
                            .enumeration => try self.translateEnumeration(expr),
                            .function => try self.translateFunction(expr, is_pointer_target),
                            else => expr.type,
                        };
                        new_expr.* = .{ .type = new_type };
                        return new_expr;
                    },
                    .identifier => {
                        const new_expr = try self.translateIdentifier(expr, is_pointer_target);
                        try self.old_to_new_map.put(expr, new_expr);
                        return new_expr;
                    },
                    else => {
                        try self.old_to_new_map.put(expr, expr);
                        return expr;
                    },
                }
            }
        }

        fn translateIdentifier(self: *@This(), expr: *const Expression, is_pointer_target: bool) !*const Expression {
            if (self.old_namespace.getExpression(expr.identifier)) |ref_expr| {
                return try self.translateExpressionEx(ref_expr, is_pointer_target);
            }
            return expr;
        }

        fn translateField(self: *@This(), field: Field, type_override: ?*const Expression) !Field {
            const new_name = try self.transformName(field.name, .field);
            return .{
                .name = new_name,
                .type = type_override orelse try self.translateExpression(field.type),
                .alignment = field.alignment,
            };
        }

        const ParameterOptions = struct {
            is_pointer_target: bool,
            is_inout: bool,
            optionality: ?bool,
            type_override: ?*const Expression,
        };

        fn translateParameter(
            self: *@This(),
            param: Parameter,
            param_opt: ParameterOptions,
        ) !Parameter {
            const new_name = if (param.name) |n| try self.transformName(n, .param) else null;
            const new_type = param_opt.type_override orelse swap: {
                var param_type: *const Expression = param.type;
                if (self.getPointerInfo(param.type)) |p| {
                    // const pointer to struct and union can become by-value argument
                    if (p.is_const and self.isTypeOf(p.child_type, .container)) {
                        if (!self.isOpaque(p.child_type)) {
                            const type_name = try self.obtainTypeName(p.child_type, .old);
                            if (!param_opt.is_pointer_target and options.type_is_by_value_fn(type_name)) {
                                param_type = p.child_type;
                            }
                        }
                    }
                }
                var new_param_type = try self.translateExpression(param_type);
                if (param_opt.optionality) |is_optional| {
                    new_param_type = try self.changeOptionality(new_param_type, is_optional);
                }
                break :swap new_param_type;
            };
            return .{
                .name = new_name,
                .type = new_type,
                .is_inout = param_opt.is_inout,
            };
        }

        fn redefineAsContainer(self: *@This(), expr: *Expression, name: []const u8) !void {
            if (expr.* != .identifier) {
                std.debug.print("Cannot convert '{s}' to container type\n", .{name});
                return error.Unexpected;
            }
            const original_type = try self.createExpression(expr.*);
            self.new_root_original_type = original_type;
            if (std.mem.eql(u8, expr.identifier, "anyopaque")) {
                expr.* = .{
                    .type = .{
                        .container = .{ .kind = "opaque" },
                    },
                };
            } else {
                var fields: []Field = &.{};
                try self.append(&fields, .{
                    .name = "_",
                    .type = original_type,
                });
                expr.* = .{
                    .type = .{
                        .container = .{
                            .layout = "packed",
                            .kind = "struct",
                            .fields = fields,
                        },
                    },
                };
            }
        }

        fn changeOptionality(self: *@This(), expr: *const Expression, is_optional: bool) !*const Expression {
            if (self.getTypeInfo(expr, .optional)) |o| {
                if (!is_optional) return o.child_type;
            } else {
                if (is_optional) {
                    return try self.createType(.{
                        .optional = .{ .child_type = expr },
                    });
                }
            }
            return expr;
        }

        fn translateEnumItem(self: *@This(), item: EnumItem) !EnumItem {
            const new_name = try self.transformName(item.name, .@"enum");
            return .{
                .name = new_name,
                .value = item.value,
            };
        }

        fn translateContainer(self: *@This(), expr: *const Expression) !Expression.Type {
            const c = expr.type.container;
            var new_fields: []Field = &.{};
            const container_name = try self.obtainTypeName(expr, .old);
            for (c.fields) |field| {
                const type_name = try self.obtainTypeName(field.type, .old);
                const type_override = find: {
                    if (options.field_override_fn(container_name, field.name, type_name)) |new_type_name| {
                        if (self.new_namespace.getExpression(new_type_name)) |new_field_type| {
                            break :find new_field_type;
                        } else {
                            std.debug.print("Unable to find new field type '{s}'", .{new_type_name});
                            return error.Unexpected;
                        }
                    }
                    break :find null;
                };
                const new_field = try self.translateField(field, type_override);
                try self.append(&new_fields, new_field);
            }
            return .{
                .container = .{
                    .layout = c.layout,
                    .kind = c.kind,
                    .backing_type = c.backing_type,
                    .fields = new_fields,
                },
            };
        }

        fn translatePointer(self: *@This(), expr: *const Expression) !Expression.Type {
            // expr is a pointer or an optional
            const p = self.getPointerInfo(expr).?;
            const child_type = try self.translateExpressionEx(p.child_type, true);
            const ptr_name = try self.obtainTypeName(expr, .old);
            const target_name = try self.obtainTypeName(p.child_type, .old);
            const is_null_terminated = options.ptr_is_null_terminated_fn(ptr_name, target_name);
            const is_many = options.ptr_is_many_fn(ptr_name, target_name);
            const is_optional = options.ptr_is_optional_fn(ptr_name, target_name);
            var new_type: Expression.Type = .{
                .pointer = .{
                    .child_type = child_type,
                    .alignment = p.alignment,
                    .sentinel = if (is_null_terminated) "0" else null,
                    .size = if (is_many) .many else .one,
                    .is_const = p.is_const,
                    .is_volatile = p.is_volatile,
                    .allows_zero = p.allows_zero,
                },
            };
            if (is_optional) {
                new_type = .{
                    .optional = .{ .child_type = try self.createType(new_type) },
                };
            }
            return new_type;
        }

        fn translateEnumeration(self: *@This(), expr: *const Expression) !Expression.Type {
            const e = expr.type.enumeration;
            var new_items: []EnumItem = &.{};
            for (e.items) |item| {
                const new_field = try self.translateEnumItem(item);
                try self.append(&new_items, new_field);
            }
            const new_enum: Expression.Type.Enumeration = .{
                .items = new_items,
                .tag_type = e.tag_type,
            };
            const enum_name = try self.obtainTypeName(expr, .old);
            if (options.enum_is_packed_struct_fn(enum_name)) {
                return .{ .container = try self.convertEnumToPackedStruct(new_enum) };
            } else {
                return .{ .enumeration = new_enum };
            }
        }

        fn convertEnumToPackedStruct(self: *@This(), e: Expression.Type.Enumeration) !Expression.Type.Container {
            var pow2_items: []EnumItem = &.{};
            for (e.items) |item| {
                if (item.value != 0 and std.math.isPowerOfTwo(item.value)) {
                    try self.append(&pow2_items, item);
                }
            }
            std.mem.sort(EnumItem, pow2_items, {}, struct {
                fn compare(_: void, lhs: EnumItem, rhs: EnumItem) bool {
                    return lhs.value < rhs.value;
                }
            }.compare);
            var blank_field_name: []const u8 = "_";
            var bits_used: isize = 0;
            var bit_fields: []Field = &.{};
            var new_fields: []Field = &.{};
            for (pow2_items) |item| {
                const pos = @ctz(item.value);
                if (bits_used != pos) {
                    // insert filler
                    const blank_field = try self.createBlankField(blank_field_name, pos - bits_used, null);
                    try self.append(&new_fields, blank_field);
                    blank_field_name = try self.allocPrint("{s}{s}", .{ blank_field_name, "_" });
                    bits_used = pos;
                }
                const new_field = try self.translateBitField(item);
                try self.append(&new_fields, new_field);
                try self.append(&bit_fields, new_field);
                bits_used += 1;
            }
            // insert final filler
            const blank_field = try self.createBlankField(blank_field_name, -bits_used, e.tag_type);
            try self.append(&new_fields, blank_field);
            var new_decls: []Declaration = &.{};
            for (e.items) |item| {
                if (item.value == 0 or !std.math.isPowerOfTwo(item.value)) {
                    var remaining = item.value;
                    for (pow2_items) |other_item| remaining &= ~other_item.value;
                    if (remaining == 0) {
                        // it can be represented as a combination of field items
                        var set_fields: []Field = &.{};
                        for (pow2_items, 0..) |pow2_item, i| {
                            if (item.value & pow2_item.value != 0) {
                                try self.append(&set_fields, bit_fields[i]);
                            }
                        }
                        const decl = try self.createBitFieldDeclaration(item.name, set_fields);
                        try self.append(&new_decls, decl);
                    } else {
                        const decl = try self.createIntDeclaration(item.name, item.value);
                        try self.append(&new_decls, decl);
                    }
                }
            }
            return .{
                .layout = "packed",
                .kind = "struct",
                .backing_type = e.tag_type,
                .fields = new_fields,
                .decls = new_decls,
            };
        }

        fn translateFunction(
            self: *@This(),
            expr: *const Expression,
            is_pointer_target: bool,
        ) !Expression.Type {
            const f = expr.type.function;
            var new_params: []Parameter = &.{};
            // look for writable pointer
            var output_types: []*const Expression = &.{};
            var inout_index: ?usize = null;
            const fn_name = try self.obtainFunctionName(expr);
            const output_start = for (0..f.parameters.len) |offset| {
                const index = f.parameters.len - offset - 1;
                const param = f.parameters[index];
                // no translation of output pointers for function pointers
                if (is_pointer_target) break index + 1;
                if (!self.isWriteTarget(param.type)) break index + 1;
                // maybe it's a in/out pointer--need to ask the callback functions
                const ptr_name = try self.obtainTypeName(param.type, .old);
                const target_type = self.getPointerTarget(param.type).?;
                const type_name = try self.obtainTypeName(target_type, .old);
                const is_input = check: {
                    if (options.ptr_is_input_fn(ptr_name, type_name)) break :check true;
                    if (options.param_is_input_fn(fn_name, param.name, index, type_name)) break :check true;
                    break :check false;
                };
                if (is_input) {
                    inout_index = index;
                    self.need_inout_import = true;
                    break index + 1;
                }
            } else 0;
            for (f.parameters[output_start..], 0..) |param, i| {
                const target_type = self.getPointerTarget(param.type).?;
                var output_type = try self.translateExpression(target_type);
                if (self.isPointer(output_type)) {
                    const type_name = try self.obtainTypeName(target_type, .old);
                    if (options.param_is_optional_fn(fn_name, param.name, output_start + i, type_name)) |is_optional| {
                        output_type = try self.changeOptionality(output_type, is_optional);
                    }
                }
                try self.append(&output_types, output_type);
            }
            // see if the translated function should return an error union
            const return_error_union = !is_pointer_target and try self.shouldReturnErrorUnion(fn_name, expr);
            const extra: usize = switch (return_error_union) {
                true => switch (try self.shouldIgnoreNonErrorRetval(fn_name, expr)) {
                    true => 0,
                    false => switch (try self.isReturningStatus(expr)) {
                        true => if (self.non_error_enum_count > 1) 1 else 0,
                        false => 1,
                    },
                },
                false => if (self.isPrimitive(f.return_type, "void")) 0 else 1,
            };
            if (extra == 1) {
                const extra_output_type = find: {
                    const type_name = try self.obtainTypeName(f.return_type, .old);
                    if (options.retval_override_fn(fn_name, type_name)) |new_type_name| {
                        if (self.new_namespace.getExpression(new_type_name)) |ref_type| {
                            break :find ref_type;
                        } else {
                            std.debug.print("Unable to find new return type '{s}'", .{new_type_name});
                            return error.Unexpected;
                        }
                    }
                    break :find try self.translateExpression(f.return_type);
                };
                try self.append(&output_types, extra_output_type);
            }
            const arg_count = f.parameters.len + extra - output_types.len;
            for (f.parameters[0..arg_count], 0..) |param, index| {
                // only pointer type can be optional
                const type_name = try self.obtainTypeName(param.type, .old);
                const new_param = try self.translateParameter(param, .{
                    .is_pointer_target = is_pointer_target,
                    .is_inout = inout_index == index,
                    .optionality = check: {
                        if (self.isPointer(param.type)) {
                            break :check options.param_is_optional_fn(fn_name, param.name, index, type_name);
                        }
                        break :check false;
                    },
                    .type_override = find: {
                        if (options.param_override_fn(fn_name, param.name, index, type_name)) |new_type_name| {
                            if (self.new_namespace.getExpression(new_type_name)) |ref_type| {
                                break :find ref_type;
                            } else {
                                std.debug.print("Unable to find new parameter type '{s}'", .{new_type_name});
                                return error.Unexpected;
                            }
                        }
                        break :find null;
                    },
                });
                try self.append(&new_params, new_param);
            }
            const payload_type: *const Expression = switch (output_types.len) {
                0 => try self.createIdentifier("void", .{}),
                1 => output_types[0],
                else => define: {
                    var arguments: []*const Expression = &.{};
                    try self.append(&arguments, try self.createExpression(.{
                        .array_init = .{
                            .initializers = output_types,
                            .is_reference = true,
                        },
                    }));
                    break :define try self.createExpression(.{
                        .function_call = .{
                            .fn_ref = try self.createIdentifier("std.meta.Tuple", .{}),
                            .arguments = arguments,
                        },
                    });
                },
            };
            const return_type = switch (return_error_union) {
                true => try self.createType(.{
                    .error_union = .{
                        .payload_type = payload_type,
                        .error_set = self.new_error_set,
                    },
                }),
                false => payload_type,
            };
            return .{
                .function = .{
                    .parameters = new_params,
                    .return_type = return_type,
                    .alignment = f.alignment,
                    .call_convention = if (is_pointer_target) f.call_convention else null,
                },
            };
        }

        fn findSubstitutions(
            self: *@This(),
            old_fn: *const Expression,
            new_fn: *const Expression,
        ) ![]const Substitution {
            var subs: []Substitution = &.{};
            for (new_fn.type.function.parameters, 0..) |new_param, index| {
                const param = old_fn.type.function.parameters[index];
                try self.append(&subs, .{
                    .old_type = param.type,
                    .new_type = new_param.type,
                    .is_inout = new_param.is_inout,
                });
            }
            const return_type = new_fn.type.function.return_type;
            const output_types: []const *const Expression = get: {
                if (self.getTypeInfo(return_type, .error_union)) |eu| {
                    if (eu.payload_type.* == .function_call) {
                        // call to std.meta.Tuple()
                        const arg = eu.payload_type.function_call.arguments[0];
                        break :get arg.array_init.initializers;
                    } else if (!self.isPrimitive(eu.payload_type, "void")) {
                        break :get &.{eu.payload_type};
                    } else {
                        break :get &.{};
                    }
                } else if (return_type.* == .function_call) {
                    const arg = return_type.function_call.arguments[0];
                    break :get arg.array_init.initializers;
                } else {
                    break :get &.{return_type};
                }
            };
            const offset = new_fn.type.function.parameters.len;
            for (output_types, 0..) |new_ot, i| {
                // look for pointer arguments in original function
                const ot = if (offset + i < old_fn.type.function.parameters.len)
                    self.getPointerTarget(old_fn.type.function.parameters[offset + i].type).?
                else if (self.non_error_enum_count > 1 and self.isTypeOf(return_type, .error_union))
                    // if an error union is returned and there're multiple enum positive statuses, then
                    // the extra output is the status, which doesn't require substitution
                    continue
                else
                    old_fn.type.function.return_type;
                try self.append(&subs, .{ .old_type = ot, .new_type = new_ot });
            }
            return subs;
        }

        fn findGlobalSubstutions(self: *@This()) ![]const Substitution {
            var iterator = self.old_to_new_map.iterator();
            const SubCount = struct {
                sub: Substitution,
                score: usize,
            };
            var global_substitution_counts: []SubCount = &.{};
            while (iterator.next()) |entry| {
                if (entry.key_ptr.*.* == .type and entry.key_ptr.*.type == .function) {
                    const old_fn = entry.key_ptr.*;
                    const new_fn = entry.value_ptr.*;
                    const subs = try self.findSubstitutions(old_fn, new_fn);
                    for (subs) |sub| {
                        if (sub.is_inout) continue;
                        if (self.isTypeOf(sub.old_type, .enumeration)) continue;
                        const old_type = self.resolveType(sub.old_type, .old);
                        const new_type = self.resolveType(sub.new_type, .new);
                        for (global_substitution_counts) |*e| {
                            if (self.isTypeEql(e.sub.old_type, old_type)) {
                                if (self.isTypeEql(e.sub.new_type, new_type)) {
                                    e.score += 1;
                                    break;
                                }
                            }
                        } else {
                            if (self.isAnonymousType(new_type)) {
                                // can't substitute with an anonymous type; need a declared type
                                try self.declareAnonymousType(new_type);
                            }
                            try self.append(&global_substitution_counts, .{
                                .sub = .{
                                    .old_type = old_type,
                                    .new_type = new_type,
                                },
                                // favor non-optional types in the global substitution table
                                .score = if (self.isTypeOf(new_type, .optional)) 0 else 1000,
                            });
                        }
                    }
                }
            }
            std.mem.sort(SubCount, global_substitution_counts, {}, struct {
                fn compare(_: void, lhs: SubCount, rhs: SubCount) bool {
                    return lhs.score > rhs.score;
                }
            }.compare);
            var global_subs: []Substitution = &.{};
            for (global_substitution_counts) |*e| {
                for (global_subs) |sub| {
                    if (self.isTypeEql(sub.old_type, e.sub.old_type)) break;
                } else {
                    try self.append(&global_subs, e.sub);
                }
            }
            return global_subs;
        }

        fn findLocalSubstitutions(
            self: *@This(),
            old_fn: *const Expression,
            new_fn: *const Expression,
            global_subs: []const Substitution,
        ) ![]LocalSubstitution {
            var local_subs: []LocalSubstitution = &.{};
            const subs = try self.findSubstitutions(old_fn, new_fn);
            for (subs, 0..) |sub, i| {
                // we need to do local substitution when the new type cannot be derived through
                // the global substitution table
                const index = if (i < old_fn.type.function.parameters.len) i else null;
                if (sub.is_inout) {
                    var inout_arguments: []*const Expression = &.{};
                    try self.append(&inout_arguments, sub.new_type);
                    const inout_type = try self.createExpression(.{
                        .function_call = .{
                            .fn_ref = try self.createIdentifier("inout", .{}),
                            .arguments = inout_arguments,
                        },
                    });
                    try self.append(&local_subs, .{ .index = index, .type = inout_type });
                } else {
                    const old_type = self.resolveType(sub.old_type, .old);
                    const new_type = self.resolveType(sub.new_type, .new);
                    const need_sub = for (global_subs) |g| {
                        if (self.isTypeEql(g.old_type, old_type)) {
                            break !self.isTypeEql(g.new_type, new_type);
                        }
                    } else !self.isTypeEql(old_type, new_type);
                    if (need_sub) {
                        try self.append(&local_subs, .{ .index = index, .type = sub.new_type });
                    }
                }
            }
            return local_subs;
        }

        fn findSplitSlices(
            self: *@This(),
            old_fn: *const Expression,
            new_fn: *const Expression,
        ) ![]SplitSlice {
            var pairs: []SplitSlice = &.{};
            const has_pointers = for (new_fn.type.function.parameters) |p| {
                if (self.isPointer(p.type)) break true;
            } else false;
            if (has_pointers) {
                const fn_name = try self.obtainFunctionName(old_fn);
                for (0..new_fn.type.function.parameters.len) |i| {
                    const is_ptr = for (pairs) |pair| {
                        if (pair.ptr_index == i) break true;
                    } else false;
                    if (!is_ptr) {
                        const param = old_fn.type.function.parameters[i];
                        const type_name = try self.obtainTypeName(param.type, .old);
                        if (options.param_is_slice_len_fn(fn_name, param.name, i, type_name)) |ptr_index| {
                            try self.append(&pairs, .{ .ptr_index = ptr_index, .len_index = i });
                        }
                    }
                }
            }
            return pairs;
        }

        fn translateBitField(self: *@This(), item: EnumItem) !Field {
            return .{
                .name = item.name,
                .type = try self.createIdentifier("bool", .{}),
                .default_value = "false",
            };
        }

        fn translateSlicePointer(self: *@This(), expr: *const Expression) !*const Expression {
            if (self.getPointerInfo(expr)) |p| {
                var new_p = p.*;
                new_p.size = .slice;
                new_p.sentinel = null;
                if (self.isOpaque(new_p.child_type))
                    new_p.child_type = try self.createIdentifier("u8", .{});
                var new_type = try self.createType(.{ .pointer = new_p });
                if (self.isTypeOf(expr, .optional))
                    new_type = try self.createType(.{ .optional = .{ .child_type = new_type } });
                return new_type;
            } else return error.Unexpected;
        }

        fn createBlankField(self: *@This(), name: []const u8, width: isize, backing_type: ?[]const u8) !Field {
            const field_type = switch (width > 0) {
                true => try self.createIdentifier("u{d}", .{width}),
                false => try self.createCode("std.meta.Int(.unsigned, @bitSizeOf({s}) - {d})", .{
                    backing_type.?,
                    -width,
                }),
            };
            return .{
                .name = name,
                .type = field_type,
                .default_value = "0",
            };
        }

        fn createBitFieldDeclaration(self: *@This(), name: []const u8, fields: []Field) !Declaration {
            const new_name = try self.transformName(name, .@"enum");
            var initializers: []Expression.StructInit.Initializer = &.{};
            for (fields) |field| {
                try self.append(&initializers, .{
                    .name = field.name,
                    .value = try self.createIdentifier("true", .{}),
                });
            }
            return .{
                .name = new_name,
                .type = try self.createIdentifier("@This()", .{}),
                .expr = try self.createExpression(.{
                    .struct_init = .{
                        .initializers = initializers,
                    },
                }),
            };
        }

        fn createIntDeclaration(self: *@This(), name: []const u8, value: i128) !Declaration {
            return .{
                .name = try self.transformName(name, .@"enum"),
                .expr = try self.createCode("{d}", .{value}),
            };
        }

        fn TypeInfo(comptime tag: Expression.Type.Tag) type {
            return switch (tag) {
                inline else => |t| @FieldType(Expression.Type, @tagName(t)),
            };
        }

        fn getTypeInfo(
            self: *@This(),
            expr: ?*const Expression,
            comptime tag: Expression.Type.Tag,
        ) ?*const TypeInfo(tag) {
            return if (expr) |e| switch (e.*) {
                .type => |*t| switch (t.*) {
                    inline else => |*info| if (@TypeOf(info.*) == TypeInfo(tag)) info else null,
                },
                .identifier => |i| if (self.old_namespace.getExpression(i)) |ref_expr|
                    self.getTypeInfo(ref_expr, tag)
                else
                    null,
                else => null,
            } else null;
        }

        fn isTypeOf(
            self: *@This(),
            expr: ?*const Expression,
            comptime tag: Expression.Type.Tag,
        ) bool {
            return self.getTypeInfo(expr, tag) != null;
        }

        fn getPointerInfo(self: *@This(), expr: ?*const Expression) ?*const Expression.Type.Pointer {
            if (self.getTypeInfo(expr, .pointer)) |p| return p;
            if (self.getTypeInfo(expr, .optional)) |o| {
                if (self.getTypeInfo(o.child_type, .pointer)) |p| return p;
            }
            return null;
        }

        fn isPointer(self: *@This(), expr: ?*const Expression) bool {
            return self.getPointerInfo(expr) != null;
        }

        fn getPointerTarget(self: *@This(), expr: ?*const Expression) ?*const Expression {
            return if (self.getPointerInfo(expr)) |p| p.child_type else null;
        }

        fn isWriteTarget(self: *@This(), expr: ?*const Expression) bool {
            if (self.getPointerInfo(expr)) |p| {
                if (!p.is_const and !self.isOpaque(p.child_type)) {
                    return true;
                }
            }
            return false;
        }

        fn isOpaque(self: *@This(), expr: ?*const Expression) bool {
            return if (self.getTypeInfo(expr, .container)) |c|
                std.mem.eql(u8, c.kind, "opaque")
            else
                self.isPrimitive(expr, "anyopaque");
        }

        fn isAnyPrimitive(self: *@This(), expr: ?*const Expression) bool {
            if (expr) |e| {
                if (e.* == .identifier) {
                    if (std.zig.isPrimitive(e.identifier)) return true;
                    if (self.old_namespace.getExpression(e.identifier)) |ref_expr|
                        if (self.isAnyPrimitive(ref_expr)) return true;
                }
            }
            return false;
        }

        fn isPrimitive(self: *@This(), expr: ?*const Expression, name: []const u8) bool {
            if (expr) |e| {
                if (e.* == .identifier) {
                    if (std.mem.eql(u8, e.identifier, name)) return true;
                    if (self.old_namespace.getExpression(e.identifier)) |ref_expr|
                        if (self.isPrimitive(ref_expr, name)) return true;
                }
            }
            return false;
        }

        fn isAnonymousType(self: *@This(), expr: ?*const Expression) bool {
            if (expr) |e| {
                if (e == self.new_root) return false;
                if (self.new_namespace.getName(e) == null) {
                    return switch (e.*) {
                        .type => switch (e.type) {
                            inline .pointer, .optional => |p| self.isAnonymousType(p.child_type),
                            else => true,
                        },
                        .identifier => false,
                        else => false,
                    };
                }
            }
            return false;
        }

        fn declareAnonymousType(self: *@This(), expr: *const Expression) !void {
            var base_type = expr;
            if (self.getPointerInfo(expr)) |p| base_type = p.child_type;
            const name = try self.allocPrint("Anonymous{d:04}", .{self.anonymous_type_count});
            self.anonymous_type_count += 1;
            try self.append(&self.new_root.type.container.decls, .{
                .public = false,
                .name = name,
                .expr = base_type,
            });
            try self.new_namespace.addExpression(name, base_type);
        }

        fn isReturningStatus(self: *@This(), fn_expr: *const Expression) !bool {
            const err_type = options.c_error_type orelse return false;
            const err_type_zig = translateCType(err_type);
            const ret_type = fn_expr.type.function.return_type;
            const name = try self.obtainTypeName(ret_type, .old);
            return std.mem.eql(u8, err_type_zig, name);
        }

        fn isReturningInvalidValue(self: *@This(), fn_expr: *const Expression) !bool {
            const ret_type = fn_expr.type.function.return_type;
            const new_type = try self.translateExpression(ret_type);
            // if pointers kept optional then it's never invalid
            if (self.isTypeOf(new_type, .optional)) return false;
            const iv = self.invalid_value_map.get(new_type) orelse check: {
                const type_name = try self.obtainTypeName(ret_type, .old);
                if (options.invalid_value_fn(type_name)) |iv| {
                    try self.invalid_value_map.put(new_type, iv);
                    // add error to error set
                    const es = @constCast(&self.new_error_set.type.error_set);
                    const has_name = for (es.names) |n| {
                        if (std.mem.eql(u8, n, iv.err_name)) break true;
                    } else false;
                    if (!has_name) {
                        try self.append(&es.names, iv.err_name);
                    }
                    break :check iv;
                }
                break :check null;
            };
            return iv != null;
        }

        fn isType(self: *@This(), expr: *const Expression) bool {
            if (expr.* == .type) return true;
            if (expr.* == .identifier) {
                if (self.old_namespace.getExpression(expr.identifier)) |ref_expr| {
                    return self.isType(ref_expr);
                } else if (std.zig.primitives.isPrimitive(expr.identifier)) {
                    return true;
                }
            }
            return false;
        }

        fn resolveType(self: *@This(), expr: *const Expression, ns: NamespaceType) *const Expression {
            if (expr.* != .identifier) return expr;
            const namespace = if (ns == .new) self.new_namespace else self.old_namespace;
            if (namespace.getExpression(expr.identifier)) |ref_expr| {
                return self.resolveType(ref_expr, ns);
            }
            return expr;
        }

        fn isTypeEql(self: *@This(), expr1: *const Expression, expr2: *const Expression) bool {
            if (expr1 == expr2) return true;
            if (expr1.* == .type and expr2.* == .type) {
                switch (expr1.type) {
                    .pointer => |p1| switch (expr2.type) {
                        .pointer => |p2| {
                            if (!self.isTypeEql(p1.child_type, p2.child_type)) return false;
                            if (!std.meta.eql(p1.alignment, p2.alignment)) return false;
                            if (!std.meta.eql(p1.sentinel, p2.sentinel)) return false;
                            if (p1.size != p2.size) return false;
                            if (p1.is_const != p2.is_const) return false;
                            if (p1.is_volatile != p2.is_volatile) return false;
                            if (p1.allows_zero != p2.allows_zero) return false;
                            return true;
                        },
                        else => return false,
                    },
                    .optional => |o1| switch (expr2.type) {
                        .optional => |o2| {
                            if (!self.isTypeEql(o1.child_type, o2.child_type)) return false;
                            return true;
                        },
                        else => return false,
                    },
                    else => return false,
                }
            } else if (expr1.* == .identifier and expr2.* == .identifier) {
                var id1 = expr1.identifier;
                var id2 = expr2.identifier;
                // pointer to void become pointer to anyopaque
                if (std.mem.eql(u8, id1, "void")) id1 = "anyopaque";
                if (std.mem.eql(u8, id2, "void")) id2 = "anyopaque";
                if (std.mem.eql(u8, id1, id2)) {
                    return true;
                } else {
                    var ref_expr1 = self.resolveType(expr1, .old);
                    var ref_expr2 = self.resolveType(expr2, .old);
                    if (self.new_root_original_type) |original_type| {
                        // use original type of when target is the new root type
                        if (ref_expr1 == self.new_root) ref_expr1 = original_type;
                        if (ref_expr2 == self.new_root) ref_expr2 = original_type;
                    }
                    if (ref_expr1 != expr1 or ref_expr2 != expr2) {
                        return self.isTypeEql(ref_expr1, ref_expr2);
                    } else {
                        return false;
                    }
                }
            } else {
                return false;
            }
        }

        fn extractInteger(self: *@This(), expr: *const Expression) ?i128 {
            switch (expr.*) {
                .any => |code| {
                    var s: []const u8 = code;
                    inline for (.{
                        .{ "@as(c_int, ", ")" },
                        .{ "@as(c_uint, ", ")" },
                        .{ "@import(\"std\").zig.c_translation.promoteIntLiteral(c_int, ", ", .hex)" },
                        .{ "@import(\"std\").zig.c_translation.promoteIntLiteral(c_uint, ", ", .hex)" },
                        .{ "__UINT64_C(", ")" },
                        .{ "__INT64_C(", ")" },
                    }) |pair| {
                        const start, const end = pair;
                        if (std.mem.startsWith(u8, s, start) and std.mem.endsWith(u8, s, end)) {
                            s = s[start.len .. s.len - end.len];
                        }
                    }
                    return std.fmt.parseInt(i128, s, 0) catch null;
                },
                .identifier => |i| if (self.old_namespace.getExpression(i)) |ref_expr| {
                    return self.extractInteger(ref_expr);
                },
                else => {},
            }
            return null;
        }

        fn shouldReturnErrorUnion(
            self: *@This(),
            fn_name: []const u8,
            fn_expr: *const Expression,
        ) !bool {
            return self.return_error_map.get(fn_expr) orelse check: {
                const can_return = (try self.isReturningStatus(fn_expr)) or (try self.isReturningInvalidValue(fn_expr));
                const does_return = can_return and options.error_union_is_returned_fn(fn_name);
                try self.return_error_map.put(fn_expr, does_return);
                break :check does_return;
            };
        }

        fn shouldIgnoreNonErrorRetval(
            self: *@This(),
            fn_name: []const u8,
            fn_expr: *const Expression,
        ) !bool {
            const can_return = self.non_error_enum_count > 1 and (try self.isReturningStatus(fn_expr));
            return can_return and !options.status_is_returned_fn(fn_name);
        }

        fn deriveErrorSet(self: *@This()) !std.meta.Tuple(&.{ *const Expression, usize }) {
            var names: [][]const u8 = &.{};
            var non_error_enum_count: usize = 0;
            if (options.c_error_type) |enum_name| {
                if (self.old_namespace.getExpression(enum_name)) |expr| {
                    if (expr.* == .type and expr.type == .enumeration) {
                        for (expr.type.enumeration.items) |item| {
                            if (options.enum_is_error_fn(item.name, item.value)) {
                                const err_name = try self.transformName(item.name, .@"error");
                                try self.append(&names, err_name);
                            } else non_error_enum_count += 1;
                        }
                    }
                }
            }
            if (options.error_enum) |enum_name| {
                if (self.new_namespace.getExpression(enum_name)) |expr| {
                    if (expr.* == .type and expr.type == .enumeration) {
                        for (expr.type.enumeration.items) |item| {
                            if (options.enum_is_error_fn(item.name, item.value)) {
                                const err_name = try self.transformName(item.name, .@"error");
                                try self.append(&names, err_name);
                            } else non_error_enum_count += 1;
                        }
                    }
                }
            }
            const has_unexpected = for (names) |n| {
                if (std.mem.eql(u8, n, "Unexpected")) break true;
            } else false;
            if (!has_unexpected) try self.append(&names, "Unexpected");
            const error_set = try self.createExpression(.{
                .type = .{
                    .error_set = .{ .names = names },
                },
            });
            return .{ error_set, non_error_enum_count };
        }

        fn obtainTranslateCall(
            self: *@This(),
            old_fn_name: []const u8,
            return_error_union: bool,
            ignore_non_error_return_value: bool,
            local_subs: []LocalSubstitution,
            split_slices: []SplitSlice,
        ) !*const Expression {
            const translate_fn_ref = if (split_slices.len > 0)
                try self.createIdentifier("{s}.translateMerge", .{options.translater})
            else
                try self.createIdentifier("{s}.translate", .{options.translater});
            var arguments: []*const Expression = &.{};
            try self.append(&arguments, try self.createCode("\"{s}\"", .{old_fn_name}));
            try self.append(&arguments, try self.createIdentifier("{}", .{return_error_union}));
            try self.append(&arguments, try self.createIdentifier("{}", .{ignore_non_error_return_value}));
            var sub_initializers: []Expression.StructInit.Initializer = &.{};
            for (local_subs) |sub| {
                const name = if (sub.index) |i|
                    try self.allocPrint("@\"{d}\"", .{i})
                else
                    "retval";
                try self.append(&sub_initializers, .{ .name = name, .value = sub.type });
            }
            try self.append(&arguments, try self.createExpression(.{
                .struct_init = .{ .initializers = sub_initializers },
            }));
            if (split_slices.len > 0) {
                var slice_initializers: []*const Expression = &.{};
                for (split_slices) |pair| {
                    var slice_inits: []Expression.StructInit.Initializer = &.{};
                    try self.append(&slice_inits, .{
                        .name = "ptr_index",
                        .value = try self.createCode("{d}", .{pair.ptr_index}),
                    });
                    try self.append(&slice_inits, .{
                        .name = "len_index",
                        .value = try self.createCode("{d}", .{pair.len_index}),
                    });
                    try self.append(&slice_initializers, try self.createExpression(.{
                        .struct_init = .{ .initializers = slice_inits },
                    }));
                }
                try self.append(&arguments, try self.createExpression(.{
                    .array_init = .{
                        .initializers = slice_initializers,
                        .is_multiline = true,
                        .is_reference = true,
                    },
                }));
            }
            return try self.createExpression(.{
                .function_call = .{ .fn_ref = translate_fn_ref, .arguments = arguments },
            });
        }

        fn obtainTranslatorSetup(self: *@This(), global_subs: []const Substitution) !*const Expression {
            const translator_fn_ref = try self.createIdentifier("api_translator.Translator", .{});
            var arguments: []*const Expression = &.{};
            var translator_options: []Expression.StructInit.Initializer = &.{};
            try self.append(&translator_options, .{
                .name = "c_import_ns",
                .value = try self.createIdentifier(options.c_import, .{}),
            });
            if (try self.obtainSubstitutions(global_subs)) |sub_expr| {
                try self.append(&translator_options, .{
                    .name = "substitutions",
                    .value = sub_expr,
                });
            }
            if (try self.obtainErrorScheme()) |scheme_expr| {
                try self.append(&translator_options, .{
                    .name = "error_scheme",
                    .value = scheme_expr,
                });
            }
            if (options.late_bind_expr) |code| {
                try self.append(&translator_options, .{
                    .name = "late_bind_fn",
                    .value = try self.createCode("{s}", .{code}),
                });
            }
            try self.append(&arguments, try self.createExpression(.{
                .struct_init = .{ .initializers = translator_options, .is_multiline = true },
            }));
            return try self.createExpression(.{
                .function_call = .{ .fn_ref = translator_fn_ref, .arguments = arguments },
            });
        }

        fn obtainSubstitutions(self: *@This(), global_subs: []const Substitution) !?*const Expression {
            const Sub = struct {
                old_name: []const u8,
                old_type: *const Expression,
                new_name: []const u8,
                new_type: *const Expression,
            };
            var subs: []Sub = &.{};
            for (global_subs) |sub| {
                const old_name = try self.obtainTypeName(sub.old_type, .new);
                const new_name = try self.obtainTypeName(sub.new_type, .new);
                if (!std.mem.eql(u8, old_name, new_name)) {
                    try self.append(&subs, .{
                        .old_name = old_name,
                        .old_type = sub.old_type,
                        .new_name = new_name,
                        .new_type = sub.new_type,
                    });
                }
            }
            std.mem.sort(Sub, subs, {}, struct {
                fn compare(_: void, lhs: Sub, rhs: Sub) bool {
                    return switch (std.mem.order(u8, lhs.old_name, rhs.old_name)) {
                        .gt => false,
                        .lt => true,
                        .eq => switch (std.mem.order(u8, lhs.new_name, rhs.new_name)) {
                            .lt => true,
                            else => false,
                        },
                    };
                }
            }.compare);
            var slice_initializers: []*const Expression = &.{};
            for (subs) |sub| {
                var struct_initializers: []Expression.StructInit.Initializer = &.{};
                try self.append(&struct_initializers, .{ .name = "old", .value = sub.old_type });
                try self.append(&struct_initializers, .{ .name = "new", .value = sub.new_type });
                try self.append(&slice_initializers, try self.createExpression(.{
                    .struct_init = .{ .initializers = struct_initializers },
                }));
            }
            if (subs.len == 0) return null;
            return self.createExpression(.{
                .array_init = .{
                    .initializers = slice_initializers,
                    .is_multiline = true,
                    .is_reference = true,
                },
            });
        }

        fn translateCType(name: []const u8) []const u8 {
            if (std.mem.eql(u8, name, "int")) return "c_int";
            if (std.mem.eql(u8, name, "unsigned int")) return "c_uint";
            if (std.mem.eql(u8, name, "size_t")) return "usize";
            if (std.mem.eql(u8, name, "_Bool")) return "bool";
            return name;
        }

        fn isUsingErrorSet(self: *@This()) bool {
            if (options.c_error_type != null or options.error_enum != null) return true;
            if (self.invalid_value_map.count() != 0) return true;
            return false;
        }

        fn obtainErrorScheme(self: *@This()) !?*const Expression {
            if (!self.isUsingErrorSet()) return null;
            const error_set = self.new_namespace.getExpression(options.error_set) orelse return error.Unexpected;
            const error_enum = find: {
                if (options.error_enum) |enum_name| {
                    break :find self.new_namespace.getExpression(enum_name) orelse {
                        std.debug.print("Unable to find error enum type '{s}'", .{enum_name});
                        return error.Unexpected;
                    };
                } else if (options.c_error_type) |enum_name| {
                    const enum_type_zig = translateCType(enum_name);
                    if (self.old_namespace.getExpression(enum_type_zig)) |old_enum| {
                        break :find try self.translateExpression(old_enum);
                    } else {
                        break :find try self.createIdentifier("{s}", .{enum_type_zig});
                    }
                }
                break :find try self.createCode("void", .{});
            };
            // initializers for list of invalid values
            var array_initializers: []*const Expression = &.{};
            var iterator = self.invalid_value_map.iterator();
            var added: std.StringHashMap(bool) = .init(self.allocator);
            while (iterator.next()) |entry| {
                const new_type = entry.key_ptr.*;
                const new_type_name = try self.obtainTypeName(new_type, .new);
                if (added.get(new_type_name) != null) continue;
                try added.put(new_type_name, true);
                const iv = entry.value_ptr.*;
                var struct_initializers: []Expression.StructInit.Initializer = &.{};
                try self.append(&struct_initializers, .{
                    .name = "type",
                    .value = new_type,
                });
                try self.append(&struct_initializers, .{
                    .name = "err_value",
                    .value = try self.createIdentifier("{s}", .{iv.err_value}),
                });
                try self.append(&struct_initializers, .{
                    .name = "err",
                    .value = try self.createIdentifier("error.{s}", .{iv.err_name}),
                });
                try self.append(&array_initializers, try self.createExpression(.{
                    .struct_init = .{ .initializers = struct_initializers },
                }));
            }
            const invalid_values = try self.createExpression(.{
                .array_init = .{
                    .initializers = array_initializers,
                    .is_multiline = true,
                },
            });
            const def_error = try self.createIdentifier("{s}.Unexpected", .{options.error_set});
            const fn_ref = try self.createIdentifier("api_translator.BasicErrorScheme", .{});
            var arguments: []*const Expression = &.{};
            try self.append(&arguments, error_enum);
            try self.append(&arguments, error_set);
            try self.append(&arguments, def_error);
            try self.append(&arguments, invalid_values);
            return try self.createExpression(.{
                .function_call = .{ .fn_ref = fn_ref, .arguments = arguments },
            });
        }

        fn obtainTypeName(self: *@This(), expr: *const Expression, ns: NamespaceType) ![]const u8 {
            const indent_before = self.indent_level;
            defer self.indent_level = indent_before;
            self.indent_level = 0;
            self.write_to_byte_array = true;
            defer self.write_to_byte_array = false;
            self.byte_array.clearRetainingCapacity();
            self.printRef(expr, ns) catch {};
            return try self.allocator.dupe(u8, self.byte_array.items);
        }

        fn obtainFunctionName(self: *@This(), expr: *const Expression) ![]const u8 {
            return self.old_namespace.getName(expr) orelse find: {
                for (self.old_root.type.container.decls) |decl| {
                    if (self.getPointerInfo(decl.expr)) |p| {
                        if (p.child_type == expr)
                            break :find decl.name;
                    }
                } else break :find try self.obtainTypeName(expr, .old);
            };
        }

        fn printImports(self: *@This()) anyerror!void {
            try self.printTxt("const std = @import(\"std\");\n");
            if (options.late_bind_expr != null) {
                // builtin is probably needed when late binding is used
                try self.printTxt("const builtin = @import(\"builtin\");\n");
            }
            try self.printFmt("const api_translator = @import(\"{s}api-translator.zig\");\n", .{
                options.zigft_path,
            });
            if (self.need_inout_import) {
                try self.printTxt("const inout = api_translator.inout;\n");
            }
            try self.printFmt("const {s} = @cImport({{\n", .{options.c_import});
            for (options.header_paths) |path| {
                try self.printFmt("@cInclude(\"{s}\");\n", .{path});
            }
            try self.printTxt("}});\n\n");
        }

        fn printRef(self: *@This(), expr: *const Expression, ns: NamespaceType) anyerror!void {
            if (ns == .old) {
                if (expr == self.old_root) {
                    try self.printTxt("@This()");
                } else if (self.old_namespace.getName(expr)) |name| {
                    try self.printFmt("{s}", .{name});
                } else {
                    try self.printExpression(expr, ns);
                }
            } else if (ns == .new) {
                if (expr == self.current_root) {
                    try self.printTxt("@This()");
                } else if (expr == self.old_root) {
                    try self.printTxt(options.c_import);
                } else if (self.new_namespace.getName(expr)) |name| {
                    try self.printFmt("{s}", .{name});
                } else if (self.isAnyPrimitive(expr)) {
                    try self.printExpression(expr, ns);
                } else if (self.old_namespace.getName(expr)) |name| {
                    try self.printFmt("{s}.{s}", .{ options.c_import, name });
                } else {
                    try self.printExpression(expr, ns);
                }
            }
        }

        fn printExpression(self: *@This(), expr: *const Expression, ns: NamespaceType) anyerror!void {
            switch (expr.*) {
                .any, .function_body => |i| try self.printFmt("{s}", .{i}),
                .identifier => |i| try self.printIdentifier(i, ns),
                .array_init => |a| try self.printArrayInit(a, ns),
                .struct_init => |s| try self.printStructInit(s, ns),
                .function_call => |f| try self.printFunctionCall(f, ns),
                .reference_to => |r| try self.printReferenceTo(r, ns),
                .type => |t| switch (t) {
                    .container => |c| {
                        const current_root_before = self.current_root;
                        defer self.current_root = current_root_before;
                        self.current_root = expr;
                        try self.printContainerDef(c, ns, expr == self.new_root);
                    },
                    .pointer => |p| try self.printPointerDef(p, ns),
                    .optional => |o| try self.printOptionalDef(o, ns),
                    .enumeration => |e| try self.printEnumerationDef(e, ns),
                    .error_set => |e| try self.printErrorSetDef(e, ns),
                    .error_union => |e| try self.printErrorUnionDef(e, ns),
                    .function => |f| try self.printFunctionDef(f, ns),
                },
                .empty => {},
            }
        }

        fn printIdentifier(self: *@This(), i: []const u8, ns: NamespaceType) anyerror!void {
            if (ns == .old) {
                try self.printFmt("{s}", .{i});
            } else {
                if (self.old_namespace.getExpression(i)) |_| {
                    try self.printFmt("{s}.{s}", .{ options.c_import, i });
                } else {
                    try self.printFmt("{s}", .{i});
                }
            }
        }

        fn printArrayInit(self: *@This(), a: Expression.ArrayInit, ns: NamespaceType) anyerror!void {
            if (a.is_reference) {
                try self.printTxt("&");
            }
            if (a.initializers.len == 0) {
                try self.printTxt(".{{}}");
                return;
            }
            if (a.is_multiline) {
                try self.printTxt(".{{\n");
                for (a.initializers) |expr| {
                    try self.printRef(expr, ns);
                    try self.printTxt(",\n");
                }
                try self.printTxt("}}");
            } else {
                try self.printTxt(".{{");
                if (a.initializers.len > 1) try self.printTxt(" ");
                for (a.initializers, 0..) |expr, i| {
                    try self.printRef(expr, ns);
                    if (i != a.initializers.len - 1) try self.printTxt(", ");
                }
                if (a.initializers.len > 1) try self.printTxt(" ");
                try self.printTxt("}}");
            }
        }

        fn printStructInit(self: *@This(), s: Expression.StructInit, ns: NamespaceType) anyerror!void {
            if (s.initializers.len == 0) {
                try self.printTxt(".{{}}");
                return;
            }
            if (s.is_multiline) {
                try self.printTxt(".{{\n");
                for (s.initializers) |field| {
                    try self.printFmt(".{s} = ", .{field.name});
                    try self.printRef(field.value, ns);
                    try self.printTxt(",\n");
                }
                try self.printTxt("}}");
            } else {
                try self.printTxt(".{{ ");
                for (s.initializers, 0..) |field, i| {
                    try self.printFmt(".{s} = ", .{field.name});
                    try self.printRef(field.value, ns);
                    if (i != s.initializers.len - 1) try self.printTxt(", ");
                }
                try self.printTxt(" }}");
            }
        }

        fn printFunctionCall(self: *@This(), f: Expression.FunctionCall, ns: NamespaceType) anyerror!void {
            try self.printRef(f.fn_ref, ns);
            try self.printTxt("(");
            for (f.arguments, 0..) |arg, i| {
                try self.printRef(arg, ns);
                if (i != f.arguments.len - 1) try self.printTxt(", ");
            }
            try self.printTxt(")");
        }

        fn printContainerDef(self: *@This(), c: Expression.Type.Container, ns: NamespaceType, is_root: bool) anyerror!void {
            if (!is_root) {
                if (c.layout) |l| try self.printFmt("{s} ", .{l});
                try self.printFmt("{s}", .{c.kind});
                if (c.backing_type) |bt| try self.printFmt("({s})", .{bt});
                if (c.fields.len == 0) {
                    try self.printTxt(" {{}}");
                } else {
                    try self.printTxt(" {{\n");
                }
            }
            for (c.fields) |field| try self.printField(field, ns);
            if (c.fields.len > 0 and c.decls.len > 0) try self.printTxt("\n");
            for (c.decls, 0..) |decl, i| {
                if (i > 0) {
                    if (self.isTypeOf(decl.type, .function) or self.isTypeOf(c.decls[i - 1].type, .function)) {
                        try self.printTxt("\n");
                    }
                }
                try self.printDeclaration(decl, ns);
            }
            if (!is_root and c.fields.len != 0) {
                try self.printTxt("}}");
            }
        }

        fn printPointerDef(self: *@This(), p: Expression.Type.Pointer, ns: NamespaceType) anyerror!void {
            switch (p.size) {
                .one => try self.printTxt("*"),
                .many => try self.printTxt("[*"),
                .slice => try self.printTxt("["),
                .c => try self.printTxt("[*c"),
            }
            if (p.sentinel) |s| try self.printFmt(":{s}", .{s});
            if (p.size != .one) try self.printTxt("]");
            if (p.allows_zero) try self.printTxt("allows_zero ");
            if (p.is_const) try self.printTxt("const ");
            if (p.alignment) |a| try self.printFmt("align({s}) ", .{a});
            if (p.is_volatile) try self.printTxt("volatile ");
            try self.printRef(p.child_type, ns);
        }

        fn printEnumerationDef(self: *@This(), e: Expression.Type.Enumeration, _: NamespaceType) anyerror!void {
            try self.printFmt("enum({s}) {{\n", .{e.tag_type});
            const is_sequential = for (e.items, 0..) |item, index| {
                if (index > 0 and item.value != e.items[index - 1].value + 1) break false;
            } else true;
            const is_hexidecimal = !is_sequential and for (e.items) |item| {
                if (item.value < 0) break false;
            } else true;
            const max_width = find: {
                var width: usize = 0;
                for (e.items) |item| {
                    width = @max(width, @bitSizeOf(@TypeOf(item.value)) - @clz(item.value) + 1);
                }
                break :find width;
            };
            for (e.items, 0..) |item, index| {
                try self.printFmt("{s}", .{item.name});
                if (!is_sequential or (index == 0 and item.value != 0)) {
                    if (is_hexidecimal) {
                        inline for (.{ 64, 32, 16, 8 }) |bits| {
                            if (max_width > (bits / 2) or bits == 8) {
                                const width = std.fmt.comptimePrint("{d}", .{bits / 4});
                                try self.printFmt(" = 0x{x:0" ++ width ++ "}", .{@as(u128, @bitCast(item.value))});
                                break;
                            }
                        }
                    } else {
                        try self.printFmt(" = {d}", .{item.value});
                    }
                }
                try self.printTxt(",\n");
            }
            if (!e.is_exhaustive) {
                try self.printTxt("_,\n");
            }
            try self.printTxt("}}");
        }

        fn printErrorSetDef(self: *@This(), e: Expression.Type.ErrorSet, _: NamespaceType) anyerror!void {
            try self.printTxt("error{{\n");
            for (e.names) |n| try self.printFmt("{s},\n", .{n});
            try self.printTxt("}}");
        }

        fn printErrorUnionDef(self: *@This(), e: Expression.Type.ErrorUnion, ns: NamespaceType) anyerror!void {
            try self.printRef(e.error_set, ns);
            try self.printTxt("!");
            try self.printRef(e.payload_type, ns);
        }

        fn printFunctionDef(self: *@This(), f: Expression.Type.Function, ns: NamespaceType) anyerror!void {
            if (f.parameters.len > 0) {
                try self.printTxt("fn (\n");
                for (f.parameters) |param| {
                    if (param.name) |n| try self.printFmt("{s}: ", .{n});
                    try self.printRef(param.type, ns);
                    try self.printTxt(",\n");
                }
                try self.printTxt(") ");
            } else {
                try self.printTxt("fn () ");
            }
            if (f.alignment) |a| try self.printFmt("align({s}) ", .{a});
            if (f.call_convention) |c| try self.printFmt("callconv({s}) ", .{c});
            try self.printRef(f.return_type, ns);
        }

        fn printReferenceTo(self: *@This(), r: *const Expression, ns: NamespaceType) anyerror!void {
            try self.printTxt("&");
            try self.printRef(r, ns);
        }

        fn printOptionalDef(self: *@This(), o: Expression.Type.Optional, ns: NamespaceType) anyerror!void {
            try self.printTxt("?");
            try self.printRef(o.child_type, ns);
        }

        fn printField(self: *@This(), field: Field, ns: NamespaceType) anyerror!void {
            try self.printFmt("{s}: ", .{field.name});
            try self.printRef(field.type, ns);
            if (field.alignment) |a| try self.printFmt(" align({s})", .{a});
            if (field.default_value) |v| try self.printFmt(" = {s}", .{v});
            try self.printTxt(",\n");
        }

        fn printDocComment(self: *@This(), text: []const u8) anyerror!void {
            var iterator = std.mem.splitScalar(u8, text, '\n');
            while (iterator.next()) |line| {
                try self.printFmt("/// {s}\n", .{line});
            }
        }

        fn printDeclaration(self: *@This(), decl: Declaration, ns: NamespaceType) anyerror!void {
            if (decl.doc_comment) |c| try self.printDocComment(c);
            if (decl.public) try self.printTxt("pub ");
            if (decl.extern_export) |e| try self.printFmt("{s}", .{e});
            const mut = if (decl.mutable) "var" else "const";
            try self.printFmt("{s} {s}", .{ mut, decl.name });
            if (decl.type) |t| {
                try self.printTxt(": ");
                try self.printRef(t, ns);
            }
            try self.printTxt(" = ");
            try self.printExpression(decl.expr, ns);
            try self.printTxt(";\n");
            if (self.add_child_type) {
                if (self.getPointerInfo(decl.expr)) |p| {
                    if (self.new_namespace.getName(p.child_type) == null) {
                        // target is not in namespace, make it accessible through the parent type
                        const ref = if (self.isTypeOf(decl.expr, .optional))
                            try self.allocPrint("@typeInfo(@typeInfo({s}).optional.child).pointer.child", .{decl.name})
                        else
                            try self.allocPrint("@typeInfo({s}).pointer.child", .{decl.name});
                        try self.new_namespace.addExpression(ref, p.child_type);
                    }
                }
            }
        }

        fn printSimpleTest(self: *@This()) !void {
            try self.printTxt("\ntest {{\n");
            try self.printTxt("inline for (comptime std.meta.declarations(@This())) |decl| {{\n");
            try self.printTxt("_ = @field(@This(), decl.name);\n");
            try self.printTxt("}}\n");
            try self.printTxt("}}\n");
        }

        fn printFmt(self: *@This(), comptime fmt: []const u8, args: anytype) anyerror!void {
            if (self.close_bracket_stack.getLastOrNull()) |close_bracket| {
                if (std.mem.startsWith(u8, fmt, close_bracket)) {
                    self.indent_level -= 1;
                    _ = self.close_bracket_stack.pop();
                }
            }
            if (self.indent_level > 0 and !self.indented) {
                for (0..self.indent_level) |_| {
                    try self.write("    ", .{});
                }
                self.indented = true;
            }
            try self.write(fmt, args);
            if (std.mem.endsWith(u8, fmt, "{\n")) {
                try self.close_bracket_stack.append("}");
                self.indent_level += 1;
            } else if (std.mem.endsWith(u8, fmt, "(\n")) {
                try self.close_bracket_stack.append(")");
                self.indent_level += 1;
            }
            if (std.mem.endsWith(u8, fmt, "\n")) {
                self.indented = false;
            }
        }

        fn printTxt(self: *@This(), comptime txt: []const u8) anyerror!void {
            return self.printFmt(txt, .{});
        }

        fn write(self: *@This(), comptime fmt: []const u8, args: anytype) anyerror!void {
            const writer = if (self.write_to_byte_array)
                self.byte_array.writer().any()
            else
                self.output_writer;
            return writer.print(fmt, args);
        }

        fn translateHeaderFile(self: *@This(), full_path: []const u8) ![]const u8 {
            var argv: [][]const u8 = &.{};
            try self.append(&argv, "zig");
            try self.append(&argv, "translate-c");
            try self.append(&argv, full_path);
            try self.append(&argv, "-lc");
            for (options.include_paths) |include_path| {
                const arg = try self.allocPrint("-I{s}", .{include_path});
                try self.append(&argv, arg);
            }
            for (options.defines) |define| {
                const arg = try self.allocPrint("-D{s}", .{define});
                try self.append(&argv, arg);
            }
            const result = try std.process.Child.run(.{
                .allocator = self.allocator,
                .argv = argv,
                .max_output_bytes = 1024 * 1024 * 128,
            });
            if (result.stderr.len != 0) {
                std.debug.print("{s}\n", .{result.stderr});
                return error.Failure;
            }
            return result.stdout;
        }

        fn findSourceFile(self: *@This(), path: []const u8) ![]const u8 {
            for (options.include_paths) |include_path| {
                const full_path = try std.fs.path.resolve(self.allocator, &.{
                    self.cwd,
                    include_path,
                    path,
                });
                if (std.fs.accessAbsolute(full_path, .{})) |_| {
                    return full_path;
                } else |_| self.allocator.free(full_path);
            }
            return error.FileNotFound;
        }

        fn allocPrint(self: *@This(), comptime fmt: []const u8, args: anytype) ![]const u8 {
            return std.fmt.allocPrint(self.allocator, fmt, args);
        }

        fn append(self: *@This(), slice_ptr: anytype, value: GrandchildOf(@TypeOf(slice_ptr))) !void {
            const len = slice_ptr.*.len;
            const capacity = calcCapacity(len);
            const new_len = len + 1;
            const new_capacity = calcCapacity(new_len);
            if (new_capacity != capacity) {
                const slice_before = slice_ptr.*.ptr[0..capacity];
                slice_ptr.* = try self.allocator.realloc(slice_before, new_capacity);
            }
            slice_ptr.*.len = new_len;
            slice_ptr.*[len] = value;
        }

        fn remove(self: *@This(), slice_ptr: anytype, index: usize) void {
            _ = GrandchildOf(@TypeOf(slice_ptr));
            const len = slice_ptr.*.len;
            var i: usize = index;
            while (i + 1 < len) : (i += 1) {
                slice_ptr.*[i] = slice_ptr.*[i + 1];
            }
            const capacity = calcCapacity(len);
            const new_len = len - 1;
            const new_capacity = calcCapacity(new_len);
            if (new_capacity != capacity) {
                const slice_before = slice_ptr.*.ptr[0..capacity];
                slice_ptr.* = self.allocator.realloc(slice_before, new_capacity) catch unreachable;
            }
            slice_ptr.*.len = new_len;
        }

        fn calcCapacity(len: usize) usize {
            return if (len > 0) std.math.ceilPowerOfTwo(usize, len) catch unreachable else 0;
        }

        fn GrandchildOf(comptime T: type) type {
            return switch (@typeInfo(T)) {
                .pointer => |pt| check: {
                    if (pt.is_const) @compileError("Cannot make modification through a const pointer");
                    break :check switch (@typeInfo(pt.child)) {
                        .pointer => |pt2| check2: {
                            if (pt2.is_const) @compileError("Slice is const");
                            break :check2 pt2.child;
                        },
                        else => @compileError("Not a pointer to a slice"),
                    };
                },
                else => @compileError("Not a pointer"),
            };
        }
    };
}

pub fn camelize(allocator: std.mem.Allocator, name: []const u8, start_index: usize, capitalize: bool) ![]const u8 {
    const underscore_count = std.mem.count(u8, name[start_index..], "_");
    const len = name.len - start_index - underscore_count;
    const buffer = try allocator.alloc(u8, len);
    const need_lower = for (name) |c| {
        if (std.ascii.isLower(c)) break false;
    } else true;
    var need_upper = capitalize;
    var i: usize = start_index;
    var j: usize = 0;
    while (i < name.len) : (i += 1) {
        if (name[i] == '_') {
            if (j > 0) need_upper = true;
        } else {
            if (need_upper) {
                buffer[j] = std.ascii.toUpper(name[i]);
                need_upper = false;
            } else {
                buffer[j] = if (need_lower or (j == 0 and !capitalize))
                    std.ascii.toLower(name[i])
                else
                    name[i];
            }
            j += 1;
        }
    }
    return buffer;
}

test "camelize" {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    var arena: std.heap.ArenaAllocator = .init(gpa.allocator());
    const allocator = arena.allocator();
    defer arena.deinit();
    const name1 = try camelize(allocator, "animal_green_dragon", 7, false);
    try expectEqualSlices(u8, "greenDragon", name1);
    const name2 = try camelize(allocator, "animal_green_dragon", 7, true);
    try expectEqualSlices(u8, "GreenDragon", name2);
    const name3 = try camelize(allocator, "ANIMAL_GREEN_DRAGON", 0, true);
    try expectEqualSlices(u8, "AnimalGreenDragon", name3);
    const name4 = try camelize(allocator, "AnimalGreenDragon", 6, false);
    try expectEqualSlices(u8, "greenDragon", name4);
}

pub fn snakify(allocator: std.mem.Allocator, name: []const u8, start_index: usize) ![]const u8 {
    const underscore_count = scan: {
        var count: usize = 0;
        var i: usize = start_index;
        while (i < name.len) : (i += 1) {
            if (std.ascii.isUpper(name[i]) and i > start_index and std.ascii.isLower(name[i - 1])) {
                count += 1;
            }
        }
        break :scan count;
    };
    const len = name.len - start_index + underscore_count;
    const buffer = try allocator.alloc(u8, len);
    var i: usize = start_index;
    var j: usize = 0;
    while (i < name.len) : (i += 1) {
        if (std.ascii.isUpper(name[i])) {
            if (i > start_index and std.ascii.isLower(name[i - 1])) {
                buffer[j] = '_';
                j += 1;
            }
            buffer[j] = std.ascii.toLower(name[i]);
            j += 1;
        } else {
            buffer[j] = name[i];
            j += 1;
        }
    }
    return buffer;
}

test "snakify" {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    var arena: std.heap.ArenaAllocator = .init(gpa.allocator());
    const allocator = arena.allocator();
    defer arena.deinit();
    const name1 = try snakify(allocator, "AnimalGreenDragon", 0);
    try expectEqualSlices(u8, "animal_green_dragon", name1);
    const name2 = try snakify(allocator, "AnimalGreenDragon", 6);
    try expectEqualSlices(u8, "green_dragon", name2);
}

pub fn ifOptionalPointer(type_name: []const u8) ?InvalidValue {
    if (isOptionalPointer(type_name)) return .{
        .err_name = "NullPointer",
        .err_value = "null",
    };
    return null;
}

pub fn isOptionalPointer(type_name: []const u8) bool {
    return inline for (.{ "[*c]", "?*", "?[" }) |prefix| {
        if (std.mem.startsWith(u8, type_name, prefix)) break true;
    } else false;
}

pub fn noParamOverride(_: []const u8, _: ?[]const u8, _: usize, _: []const u8) ?[]const u8 {
    return null;
}

pub fn noRetvalOverride(_: []const u8, _: []const u8) ?[]const u8 {
    return null;
}

pub fn noFieldOverride(_: []const u8, _: []const u8, _: []const u8) ?[]const u8 {
    return null;
}

pub fn makeNoChange(_: std.mem.Allocator, arg: []const u8) std.mem.Allocator.Error![]const u8 {
    return arg;
}

pub fn provideNoComment(_: std.mem.Allocator, _: []const u8, _: []const u8) std.mem.Allocator.Error!?[]const u8 {
    return null;
}

pub fn removeArgPrefix(_: std.mem.Allocator, arg: []const u8) std.mem.Allocator.Error![]const u8 {
    return if (std.mem.startsWith(u8, arg, "arg_")) arg[4..] else arg;
}

pub fn isNonZero(_: []const u8, value: i128) bool {
    return value != 0;
}

pub fn neverByValue(_: []const u8) bool {
    return false;
}

pub fn neverPackedStruct(_: []const u8) bool {
    return false;
}

pub fn neverOptional(_: []const u8, _: []const u8) bool {
    return false;
}

pub fn neverInputPtr(_: []const u8, _: []const u8) bool {
    return false;
}

pub fn alwaysTrue(_: []const u8, _: ?[]const u8, _: usize, _: []const u8) bool {
    return true;
}

pub fn notFunctionSpecific(_: []const u8, _: ?[]const u8, _: usize, _: []const u8) ?bool {
    return null;
}

pub fn neverInput(_: []const u8, _: ?[]const u8, _: usize, _: []const u8) bool {
    return false;
}

pub fn notErrorValue(_: []const u8) bool {
    return false;
}

pub fn notEnumItem(_: []const u8) ?EnumInfo {
    return null;
}

pub fn neverSliceLength(_: []const u8, _: ?[]const u8, _: usize, _: []const u8) ?usize {
    return null;
}

pub fn neverReturned(_: []const u8) bool {
    return false;
}

pub fn alwaysReturned(_: []const u8) bool {
    return true;
}

pub fn isTargetChar(_: []const u8, target_type: []const u8) bool {
    const char_types: []const []const u8 = &.{ "u8", "wchar_t", "char16_t" };
    return for (char_types) |char_type| {
        if (std.mem.eql(u8, target_type, char_type)) break true;
    } else false;
}

fn asComptimeInt(comptime s: []const u8) comptime_int {
    return comptime calc: {
        var value = 0;
        for (s) |c| {
            const a: ?comptime_int = switch (c) {
                '0'...'9', 'A'...'Z' => c,
                'a'...'z' => std.ascii.toUpper(c),
                else => null,
            };
            if (a) |v| value = value * 128 + v;
        }
        break :calc value;
    };
}

test "asComptimeInt" {
    try expectEqual(asComptimeInt("HelloWorld"), asComptimeInt("hello world"));
    try expectEqual(asComptimeInt("hello_world"), asComptimeInt("helloworld"));
}

test "Translator.SwapType" {
    const OldStruct = extern struct {
        number1: i32,
        number2: i32,
    };
    const NewStruct = extern struct {
        a: i32,
        b: i32,
    };
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .substitutions = &.{
            .{ .old = OldStruct, .new = NewStruct },
            .{ .old = *OldStruct, .new = *NewStruct },
            .{ .old = [*]OldStruct, .new = [*]NewStruct },
        },
        .error_scheme = BasicErrorScheme(c_uint, error{Unexpected}, error.Unexpected, .{}),
    });
    const SwapType = c_to_zig.SwapType;
    const T1 = SwapType(OldStruct, .old_to_new);
    try expectEqual(T1, NewStruct);
    const T2 = SwapType(*OldStruct, .old_to_new);
    try expectEqual(T2, *NewStruct);
    const T3 = SwapType([*]OldStruct, .old_to_new);
    try expectEqual(T3, [*]NewStruct);
    const T4 = SwapType(NewStruct, .new_to_old);
    try expectEqual(T4, OldStruct);
}

test "Translator.Substitute" {
    const OldStruct = extern struct {
        number1: i32,
        number2: i32,
    };
    const NewStruct = extern struct {
        a: i32,
        b: i32,
    };
    const NewEnum = enum(c_uint) { a, b, c };
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .substitutions = &.{
            .{ .old = OldStruct, .new = NewStruct },
            .{ .old = *OldStruct, .new = *NewStruct },
            .{ .old = [*]OldStruct, .new = [*]NewStruct },
        },
        .error_scheme = BasicErrorScheme(c_uint, error{Unexpected}, error.Unexpected, .{}),
    });
    const Substitute = c_to_zig.Substitute;
    const T1 = Substitute(OldStruct, .{}, 0, 1);
    try expectEqual(T1, NewStruct);
    const T2 = Substitute(*OldStruct, .{}, 0, 1);
    try expectEqual(T2, *NewStruct);
    const T3 = Substitute([*]OldStruct, .{}, 0, 1);
    try expectEqual(T3, [*]NewStruct);
    const T4 = Substitute(c_uint, .{ .@"3" = NewEnum }, 3, 5);
    try expectEqual(T4, NewEnum);
    const T5 = Substitute(c_uint, .{ .@"-2" = NewEnum }, 3, 5);
    try expectEqual(T5, NewEnum);
    const T6 = Substitute(c_uint, .{ .@"-2" = NewEnum }, 2, 5);
    try expectEqual(T6, c_uint);
}

test "Translator.WritableTarget" {
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .error_scheme = BasicErrorScheme(c_uint, error{Unexpected}, error.Unexpected, .{}),
    });
    const WritableTarget = c_to_zig.WritableTarget;
    const Null = @TypeOf(null);
    const T1 = WritableTarget(*usize) orelse Null;
    try expectEqual(T1, usize);
    const T2 = WritableTarget(*const usize) orelse Null;
    try expectEqual(T2, Null);
    const T3 = WritableTarget(*void) orelse Null;
    try expectEqual(T3, Null);
    const T4 = WritableTarget(*anyopaque) orelse Null;
    try expectEqual(T4, Null);
    const T5 = WritableTarget(*opaque {}) orelse Null;
    try expectEqual(T5, Null);
    const T6 = WritableTarget(*type) orelse Null;
    try expectEqual(T6, Null);
}

test "Translator.convert (basic)" {
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .error_scheme = BasicErrorScheme(c_uint, error{Unexpected}, error.Unexpected, .{}),
    });
    const convert = c_to_zig.convert;
    const OldStruct1 = extern struct {
        number1: i32,
        number2: i32,
    };
    const NewStruct1 = extern struct {
        a: i32,
        b: i32,
    };
    const NewStruct2 = packed struct(u32) {
        flag1: bool = true,
        flag2: bool = false,
        flag3: bool = true,
        _: u29 = 0,
    };
    const StatusEnum = enum(c_uint) {
        ok,
        failure,
        unexpected,
    };
    const new1: NewStruct1 = .{ .a = 123, .b = 456 };
    const old1: OldStruct1 = convert(OldStruct1, new1);
    try expectEqual(old1.number2, 456);
    const old_ptr1 = convert(*const OldStruct1, &new1);
    try expectEqual(old_ptr1.number2, 456);
    const enum1: StatusEnum = .failure;
    const old_enum1 = convert(c_uint, enum1);
    try expectEqual(old_enum1, 1);
    const new2: NewStruct2 = .{};
    const old_enum2 = convert(c_uint, new2);
    try expectEqual(old_enum2, 0b101);
    const old_enum3: c_uint = 0b110;
    const new3 = convert(NewStruct2, old_enum3);
    try expectEqual(new3, NewStruct2{ .flag1 = false, .flag2 = true, .flag3 = true });
}

test "Translator.convert (function pointer)" {
    const OldStruct1 = extern struct {
        number1: i32,
        number2: i32,
    };
    const NewStruct1 = extern struct {
        a: i32,
        b: i32,
    };
    const OldStruct2 = extern struct {
        callback1: *const fn () callconv(.c) void,
        callback2: *const fn (*const OldStruct1) callconv(.c) c_uint,
    };
    const ErrorSet = error{ Failure, Unexpected };
    const StatusEnum = enum(c_uint) {
        ok,
        failure,
        unexpected,
    };
    const NewStruct2 = extern struct {
        cb1: *const fn () callconv(.c) void,
        cb2: *const fn (*const NewStruct1) callconv(.c) StatusEnum,
    };
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .substitutions = &.{
            .{ .old = *const OldStruct1, .new = *const NewStruct1 },
        },
        .error_scheme = BasicErrorScheme(StatusEnum, ErrorSet, error.Unexpected, .{}),
    });
    const convert = c_to_zig.convert;
    const ns = struct {
        var called1 = false;
        var called2 = false;
        var result2: ?NewStruct1 = null;

        fn func1() callconv(.c) void {
            called1 = true;
        }

        fn func2(ptr: *const NewStruct1) callconv(.c) StatusEnum {
            called2 = true;
            result2 = ptr.*;
            return .ok;
        }
    };
    const old1 = convert(OldStruct2, NewStruct2{ .cb1 = ns.func1, .cb2 = ns.func2 });
    old1.callback1();
    try expectEqual(ns.called1, true);
    const input: OldStruct1 = .{ .number1 = 123, .number2 = 456 };
    const res1 = old1.callback2(&input);
    try expectEqual(0, res1);
    try expectEqual(true, ns.called2);
    try expectEqual(NewStruct1{ .a = 123, .b = 456 }, ns.result2);
}

test "Translator.Translated" {
    const OldStruct = extern struct {
        number1: i32,
        number2: i32,
    };
    const NewStruct = extern struct {
        a: i32,
        b: i32,
    };
    const StatusEnum = enum(c_uint) {
        ok,
        failure,
        unexpected,
    };
    const ErrorSet = error{
        Failure,
        Unexpected,
    };
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .substitutions = &.{
            .{ .old = OldStruct, .new = NewStruct },
            .{ .old = *OldStruct, .new = *NewStruct },
            .{ .old = []const OldStruct, .new = []const NewStruct },
            .{ .old = ?*const OldStruct, .new = *const NewStruct },
        },
        .error_scheme = BasicErrorScheme(StatusEnum, ErrorSet, error.Unexpected, .{}),
    });
    const Fn1 = c_to_zig.Translated(fn (i32, OldStruct) StatusEnum, true, false, .{});
    try expectEqual(fn (i32, NewStruct) ErrorSet!void, Fn1);
    const Fn2 = c_to_zig.Translated(fn (i32, []const OldStruct) StatusEnum, true, false, .{});
    try expectEqual(fn (i32, []const NewStruct) ErrorSet!void, Fn2);
    const Fn3 = c_to_zig.Translated(fn (i32, *OldStruct) StatusEnum, true, false, .{});
    try expectEqual(fn (i32) ErrorSet!NewStruct, Fn3);
    const Fn4 = c_to_zig.Translated(fn (i32, *bool, *OldStruct) StatusEnum, true, false, .{});
    try expectEqual(fn (i32) ErrorSet!std.meta.Tuple(&.{ bool, NewStruct }), Fn4);
    const Fn5 = c_to_zig.Translated(fn (i32, OldStruct) bool, false, false, .{});
    try expectEqual(fn (i32, NewStruct) bool, Fn5);
    const Fn6 = c_to_zig.Translated(fn (i32, OldStruct) c_int, false, false, .{});
    try expectEqual(fn (i32, NewStruct) c_int, Fn6);
    const Fn7 = c_to_zig.Translated(fn (i32, OldStruct) c_int, false, true, .{});
    try expectEqual(fn (i32, NewStruct) void, Fn7);
    const Fn8 = c_to_zig.Translated(fn (i32, *bool, ?*const OldStruct) StatusEnum, true, false, .{});
    try expectEqual(fn (i32, *bool, *const NewStruct) ErrorSet!void, Fn8);
}

test "Translator.translate" {
    const OldStruct = extern struct {
        number1: i32,
        number2: i32,
    };
    const NewStruct = extern struct {
        a: i32 = 1,
        b: i32 = 2,
    };
    const StatusEnum = enum(c_uint) {
        ok,
        failure,
        unexpected,
    };
    const ErrorSet = error{
        Failure,
        Unexpected,
    };
    const ActionEnum = enum(c_uint) {
        eat,
        leave,
        shoot,
    };
    const c = struct {
        fn hello(_: OldStruct, _: i32) callconv(.c) c_uint {
            return 0;
        }

        fn world(_: i32, ptr: *OldStruct) callconv(.c) c_uint {
            ptr.* = .{ .number1 = 123, .number2 = 456 };
            return 0;
        }
    };
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .substitutions = &.{
            .{ .old = OldStruct, .new = NewStruct },
        },
        .error_scheme = BasicErrorScheme(StatusEnum, ErrorSet, error.Unexpected, .{}),
    });
    _ = ActionEnum;
    const func1 = c_to_zig.translate("hello", true, false, .{});
    try expectEqual(@TypeOf(func1), fn (NewStruct, i32) ErrorSet!void);
    try func1(.{}, 123);
}

test "Translator.SliceMerged" {
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .error_scheme = NullErrorScheme,
    });
    const SliceMerged = c_to_zig.SliceMerged;
    const Fn1 = SliceMerged(fn (usize, *const u8) usize, &.{
        .{ .len_index = 0, .ptr_index = 1 },
    });
    try expectEqual(fn ([]const u8) usize, Fn1);
    const Fn2 = SliceMerged(fn (*anyopaque, *const u8, usize, *const u8, usize) void, &.{
        .{ .len_index = 2, .ptr_index = 1 },
        .{ .len_index = 4, .ptr_index = 3 },
    });
    try expectEqual(fn (*anyopaque, []const u8, []const u8) void, Fn2);
}

test "Translator.mergeSlice" {
    const c = struct {};
    const c_to_zig = Translator(.{
        .c_import_ns = c,
        .error_scheme = NullErrorScheme,
    });
    const mergeSlice = c_to_zig.mergeSlice;
    const ns = struct {
        var ptr_received: ?[*]const u8 = null;
        var len_received: ?u32 = null;

        fn call1(len: u32, ptr: [*]const u8) void {
            len_received = len;
            ptr_received = ptr;
        }

        fn call2(len: u32, ptr_maybe: ?*const anyopaque) void {
            if (ptr_maybe) |ptr| {
                len_received = len;
                ptr_received = @ptrCast(ptr);
            } else {
                len_received = 0;
                ptr_received = null;
            }
        }
    };
    const f1 = mergeSlice(ns.call1, &.{
        .{ .len_index = 0, .ptr_index = 1 },
    });
    f1("Hello world");
    try expectEqual(11, ns.len_received);
    try expectEqualSlices(u8, "Hello world", ns.ptr_received.?[0..11]);
    const f2 = mergeSlice(ns.call2, &.{
        .{ .len_index = 0, .ptr_index = 1 },
    });
    f2(null);
    try expectEqual(0, ns.len_received);
    f2("Hello world");
    try expectEqual(11, ns.len_received);
    try expectEqualSlices(u8, "Hello world", ns.ptr_received.?[0..11]);
}
