pub const std = @import("std");

const Array = @import("array.zig").Array;
const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const castTo = c.castTo;
const Callable = @import("callable.zig").Callable;
const Dictionary = @import("dictionary.zig").Dictionary;
const failure = @import("failure.zig");
const unsupported = failure.unsupported;
const Object = @import("object.zig").Object;
const Resource = @import("resource.zig").Resource;
const String = @import("string.zig").String;
const Value = @import("value.zig").Value;

pub const Function = struct {
    pub fn getName(self: *const @This()) ?*String {
        const zstr = self.impl.common.function_name orelse return null;
        return castTo(String, zstr);
    }

    pub const Arguments = struct {
        pub fn this(self: *const @This()) Value {
            return castTo(Value, &self.impl.This).*;
        }

        pub fn getExtraNamed(self: *const @This()) ?*Array {
            const zarr = self.impl.extra_named_params orelse return null;
            return castTo(Array, zarr);
        }

        pub fn callee(self: *const @This()) *Function {
            return castTo(Function, self.impl.func);
        }

        pub fn iterate(self: *const @This()) Iterator {
            return .init(self);
        }

        fn getInfo(self: *const @This()) c.ArgPtrCountExtra {
            var info: c.ArgPtrCountExtra = undefined;
            c.get_argument_info(&self.impl, &info);
            return info;
        }

        pub const Iterator = struct {
            pub fn init(args: *const Arguments) @This() {
                const info = args.getInfo();
                var len = info.len;
                var total = len;
                const named = get: {
                    if (info.extra) {
                        // extra_named_params contains bogus values when it's not used
                        if (args.getExtraNamed()) |arr| {
                            len += 1;
                            total += arr.length();
                            break :get arr.toValue();
                        }
                    }
                    break :get null;
                };
                return .{
                    .arg_ptr = @ptrCast(info.ptr),
                    .len = len,
                    .total = total,
                    .this = args.this(),
                    .named_params = named,
                    .callee = args.callee(),
                };
            }

            pub fn length(self: *const @This()) usize {
                return self.len;
            }

            pub fn hasNamed(self: *const @This()) bool {
                return self.named_params != null;
            }

            pub fn next(self: *@This()) ?Value {
                return if (self.peek(self.index)) |value| get: {
                    self.index += 1;
                    break :get value;
                } else null;
            }

            pub fn peek(self: *@This(), index: usize) ?Value {
                if (index < self.len) {
                    // return named parameters as last argument
                    if (index == self.len - 1) {
                        if (self.named_params) |p| return p;
                    }
                    // return this pointer as first argument
                    if (self.use_this_first and index == 0) return self.this;
                    // return regular argument
                    const offset: usize = if (self.use_this_first) 1 else 0;
                    return self.arg_ptr[index - offset];
                } else {
                    return null;
                }
            }

            pub fn reset(self: *@This()) void {
                self.index = 0;
            }

            pub fn createArrayOf(self: *@This()) *Array {
                self.reset();
                const arr = Array.create();
                while (self.next()) |value| arr.append(value);
                return arr;
            }

            pub fn makeThisFirst(self: *@This()) !void {
                if (!self.use_this_first) {
                    self.use_this_first = true;
                    self.len += 1;
                }
            }

            pub fn extract(self: *@This(), comptime T: type) !T {
                std.debug.assert(self.index == 0);
                // make sure T is a struct/tuple
                if (@typeInfo(T) != .@"struct") @compileError("Struct type expected, received: " ++ @typeName(T));
                // check argument count
                const min, const max = init: {
                    const field_types = @typeInfo(T).@"struct".field_types;
                    var required: usize = 0;
                    inline for (field_types) |FT| {
                        if (@typeInfo(FT) != .optional) required += 1;
                    }
                    break :init .{ required, field_types.len };
                };
                try self.verifyCount(min, max);
                var set: T = undefined;
                var mismatch: ?ArgumentMismatch = null;
                var required_remaining = min;
                inline for (@typeInfo(T).@"struct".field_names, 0..) |arg_name, i| {
                    const FT = @TypeOf(@field(set, arg_name));
                    const VT, const optional = switch (@typeInfo(FT)) {
                        .optional => |opt| .{ opt.child, true },
                        else => .{ FT, false },
                    };
                    // take value for optional argument only when there're enough left to satistfy
                    // remaining required ones
                    if (!optional or i + required_remaining < self.len) {
                        const arg = self.next().?;
                        const value = arg.convertTo(VT) catch |err| report: {
                            if (mismatch == null) {
                                // remember the first mismatch
                                mismatch = .{
                                    .fn_name = self.callee.getName(),
                                    .arg_name = arg_name,
                                    .value_type = valueTypeName(VT),
                                    .index = i,
                                    .value = arg,
                                    .err = err,
                                };
                            }
                            self.index -= 1;
                            // break out of for loop if argument is required
                            if (!optional) break;
                            break :report null;
                        };
                        @field(set, arg_name) = value;
                        if (!optional) required_remaining -= 1;
                    } else {
                        @field(set, arg_name) = null;
                    }
                }
                if (mismatch) |m| {
                    // report the mismatch only if we've failed to reach the end
                    if (self.index < self.len) return m.report();
                }
                return set;
            }

            pub fn extractNamed(self: *@This(), comptime T: type) !T {
                // method should be called prior to actual iteration
                std.debug.assert(self.index == 0);
                // make sure T is a tuple
                const valid = switch (@typeInfo(T)) {
                    .@"struct" => |st| !st.is_tuple,
                    else => false,
                };
                if (!valid) @compileError("Struct type expected, received: " ++ @typeName(T));
                var set: T = undefined;
                var mismatch: ?ArgumentMismatch = null;
                inline for (@typeInfo(T).@"struct".field_names) |arg_name| {
                    const FT = @TypeOf(@field(set, arg_name));
                    const VT, const optional = switch (@typeInfo(FT)) {
                        .optional => |opt| .{ opt.child, true },
                        else => .{ FT, false },
                    };
                    const arg_maybe: ?*Value = get: {
                        const args = self.named_params orelse break :get null;
                        if (args.get(arg_name) catch null) |value| {
                            args.delete(arg_name);
                            break :get value;
                        }
                    };
                    if (arg_maybe) |arg| {
                        const value = arg.convertTo(VT) catch |err| {
                            mismatch = .{
                                .fn_name = self.callee.getName(),
                                .arg_name = arg_name,
                                .value = arg,
                                .value_type = valueTypeName(FT),
                                .err = err,
                            };
                            break;
                        };
                        @field(set, arg_name) = value;
                    } else {
                        if (optional) {
                            @field(set, arg_name) = null;
                        } else {
                            mismatch = .{
                                .fn_name = self.callee.getName(),
                                .arg_name = arg_name,
                                .value = .fromNull(),
                                .value_type = valueTypeName(FT),
                                .err = error.Missing,
                            };
                            break;
                        }
                    }
                }
                if (mismatch) |m| return m.report();
                if (self.named_params) |args| {
                    // if all named arguments were taken out, shrink the argument list
                    if (args.length() == 0) {
                        self.named_params = null;
                        self.len -= 1;
                    }
                }
                return set;
            }

            pub fn verifyCount(self: *const @This(), min: usize, max: usize) !void {
                if (self.len < min or self.len > max) {
                    const fn_name = if (self.callee.getName()) |s| s.slice() else "(unknown)";
                    return failure.report("{s}() expects {s} {d} argument{s}, {d} given{s}", .{
                        fn_name,
                        if (max > min)
                            "at most"
                        else if (self.len < min)
                            "at least"
                        else
                            "exactly",
                        if (max > min) max else min,
                        if (min != 1) "s" else "",
                        self.len,
                        if (self.hasNamed()) " (the last being named arguments)" else "",
                    });
                }
            }

            fn valueTypeName(comptime T: type) []const u8 {
                @setEvalBranchQuota(2_000_000);
                return comptime switch (@typeInfo(T)) {
                    .bool => "boolean",
                    .int => "int",
                    .float => "float",
                    .pointer => |pt| switch (pt.size) {
                        .one => switch (pt.child) {
                            String => "string",
                            Array => "array",
                            Object => "object",
                            Resource => "resource",
                            else => unsupported(T),
                        },
                        .slice => switch (pt.child) {
                            u8 => "string",
                            else => unsupported(T),
                        },
                        else => unsupported(T),
                    },
                    .optional => |opt| std.fmt.comptimePrint("?{s}", .{valueTypeName(opt.child)}),
                    .@"struct" => switch (T) {
                        Callable => "callable",
                        else => unsupported(T),
                    },
                    .@"union" => |un| switch (T) {
                        Dictionary => "array|object",
                        else => format: {
                            const len = un.field_types.len;
                            var names: [len][]const u8 = undefined;
                            var combined_name_len: usize = 0;
                            for (un.field_types, 0..) |FT, i| {
                                const name = valueTypeName(FT);
                                names[i] = name;
                                combined_name_len += name.len;
                                if (i != len - 1) combined_name_len += 1;
                            }
                            var combined_name: [combined_name_len]u8 = undefined;
                            var offset: usize = 0;
                            for (0..len) |i| {
                                const name = names[i];
                                @memcpy(combined_name[offset .. offset + name.len], name);
                                offset += name.len;
                                if (offset < combined_name_len) {
                                    combined_name[offset] = '|';
                                    offset += 1;
                                }
                            }
                            break :format &combined_name;
                        },
                    },
                    else => unsupported(T),
                };
            }

            const ArgumentMismatch = struct {
                fn_name: ?*String = null,
                arg_name: []const u8,
                value_type: []const u8,
                index: ?usize = null,
                value: Value,
                err: anyerror,

                pub fn report(self: @This()) error{FailureReported} {
                    const fn_name = if (self.fn_name) |n| n.slice() else "(unknown)";
                    if (self.index) |index| {
                        return switch (self.err) {
                            error.NegativeValue => failure.report("{s}(): Argument #{d} ${s} must be a positive integer, received {d}", .{
                                fn_name,
                                index + 1,
                                self.arg_name,
                                self.value.getInteger() catch unreachable,
                            }),
                            else => failure.report("{s}(): Argument #{d} (${s}) must be of type {s}, {s} given", .{
                                fn_name,
                                index + 1,
                                self.arg_name,
                                self.value_type,
                                self.value.kind().name(),
                            }),
                        };
                    } else {
                        return switch (self.err) {
                            error.NegativeValue => failure.report("{s}(): Named argument ${s} must be a positive integer, received {d}", .{
                                fn_name,
                                self.arg_name,
                                self.value.getInteger() catch unreachable,
                            }),
                            error.Missing => failure.report("{s}(): Named argument ${s} is required and expected to be of type {s}", .{
                                fn_name,
                                self.arg_name,
                                self.value_type,
                            }),
                            else => failure.report("{s}(): Named argument ${s} must be of type {s}, {s} given", .{
                                fn_name,
                                self.arg_name,
                                self.value_type,
                                self.value.kind().name(),
                            }),
                        };
                    }
                }
            };

            arg_ptr: [*]Value,
            this: Value,
            use_this_first: bool = false,
            named_params: ?Value,
            len: usize,
            total: usize,
            index: usize = 0,
            callee: *Function,
        };

        impl: pd.zend_execute_data,
    };

    impl: pd.zend_function,
};
