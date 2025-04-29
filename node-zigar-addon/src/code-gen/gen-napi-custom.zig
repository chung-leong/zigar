pub const version = c.NAPI_VERSION;

pub fn createAddon(comptime attachExports: anytype) void {
    _ = struct {
        export fn node_api_module_get_api_version_v1() i32 {
            return version;
        }

        export fn napi_register_module_v1(env: Env, exports: Value) ?Value {
            attachExports(env, exports) catch |err| {
                std.debug.print("Unable to register Node API module: {s}", .{getErrorMessage(err)});
            };
            return null;
        }
    };
}

pub fn createCallback(
    self: *@This(),
    utf8name: ?[]const u8,
    comptime func: anytype,
    comptime need_this: bool,
    data: ?*anyopaque,
) Error!Value {
    const FT = @TypeOf(func);
    const f = switch (@typeInfo(FT)) {
        .@"fn" => |f| f,
        else => @compileError("Function expected, found '" + @typeName(FT) + "'"),
    };
    // figure out how many arguments the function has and whether it needs the data pointer
    comptime var need_data = false;
    comptime var need_env = false;
    comptime var arg_count: usize = 0;
    comptime {
        for (f.params, 0..) |param, i| {
            const PT = param.type orelse @compileError("Missing parameter type");
            if (!need_env and PT == Env) {
                if (!need_data and i != 0) @compileError("Env is expected to be the first argument");
                if (need_data and i != 1) @compileError("Env is expected to be the second argument");
                need_env = true;
            } else if (PT == Value) {
                arg_count += 1;
            } else if (!need_data and @typeInfo(PT) == .pointer) {
                if (i != 0) @compileError("Data pointer is expected to be the first argument");
                need_data = true;
            } else @compileError("Unexpected argument '" + @typeName(PT) + "'");
        }
        if (need_this) {
            if (arg_count == 0) @compileError("Missing this argument");
            arg_count -= 1;
        }
    }
    const ns = struct {
        fn callback(env: Env, cb_info: CallbackInfo) callconv(.c) Value {
            return handleCall(env, cb_info) catch |err| {
                env.throwError(null, getErrorMessage(err)) catch {};
                return env.getUndefined() catch @panic("Cannot even get undefined");
            };
        }

        fn handleCall(env: Env, cb_info: CallbackInfo) !Value {
            // retrieve arguments from Node
            var argc = arg_count;
            var argv: [arg_count]Value = undefined;
            const this, const ptr = try env.getCbInfo(cb_info, &argc, &argv);
            // copy arguments into arg tuple
            var args: std.meta.ArgsTuple(FT) = undefined;
            comptime var offset: usize = 0;
            if (need_data) {
                args[offset] = @ptrCast(ptr.?);
                offset += 1;
            }
            if (need_env) {
                args[offset] = env;
                offset += 1;
            }
            if (need_this) {
                args[offset] = this;
                offset += 1;
            }
            inline for (0..arg_count) |i| {
                args[offset + i] = if (i < argc) argv[i] else try env.getUndefined();
            }
            // call function
            const retval = @call(.auto, func, args);
            // check for error if it's possible
            const result = switch (@typeInfo(@TypeOf(retval))) {
                .error_union => try retval,
                else => retval,
            };
            // deal with void retval
            const RT = @TypeOf(result);
            return switch (RT) {
                Value => result,
                void => try env.getUndefined(),
                else => @compileError("Return value must be void or Value, found '" + @typeName(RT) + "'"),
            };
        }
    };
    if ((need_data and data == null) or (!need_data and data != null)) {
        return error.InvalidArg;
    }
    return try self.createFunction(utf8name, ns.callback, data);
}

fn getErrorMessage(err: anytype) [:0]const u8 {
    @setEvalBranchQuota(200000);
    switch (err) {
        inline else => |e| {
            const message = comptime decamelize: {
                const name = @errorName(e);
                var cap_count: usize = 0;
                for (name, 0..) |letter, i| {
                    if (i > 0 and std.ascii.isUpper(letter)) cap_count += 1;
                }
                var buffer: [name.len + cap_count + 1]u8 = undefined;
                var index: usize = 0;
                for (name, 0..) |letter, i| {
                    if (std.ascii.isUpper(letter)) {
                        if (i > 0) {
                            buffer[index] = ' ';
                            index += 1;
                            buffer[index] = std.ascii.toLower(letter);
                        } else {
                            buffer[index] = letter;
                        }
                    } else {
                        buffer[index] = letter;
                    }
                    index += 1;
                }
                buffer[index] = 0;
                break :decamelize buffer;
            };
            return @ptrCast(&message);
        },
    }
}

fn getProcAddress(name: [:0]const u8) *const anyopaque {
    const module = std.os.windows.kernel32.GetModuleHandleW(null) orelse unreachable;
    return std.os.windows.kernel32.GetProcAddress(module, name) orelse {
        var buffer: [256]u8 = undefined;
        const msg = std.fmt.bufPrint(&buffer, "Unable to import function: {s}", .{name}) catch &buffer;
        @panic(msg);
    };
}

const late_binder = switch (builtin.target.os.tag) {
    .windows => getProcAddress,
    else => null,
};
