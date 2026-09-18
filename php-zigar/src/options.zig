const std = @import("std");
const builtin = @import("builtin");

const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const dyn_lib = @import("dyn-lib.zig");
const extension = @import("extension.zig");
const failure = @import("failure.zig");
const LoopType = @import("event-loop.zig").LoopType;
const php = @import("php.zig");
const IniEntryOG = php.IniEntry;
const StringOG = php.String;
const php_ng = @import("php-new.zig");
const castTo = php_ng.castTo;
const Dictionary = php_ng.Dictionary;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;

pub const Options = struct {
    recompile: bool = true,
    clean: bool = false,
    event_loop: LoopType = .temporary,
    module_rel_path: [:0]const u8 = "../lib",
    build_dir: [:0]const u8,
    build_dir_size: c_long = 4 * 1024 * 1024 * 1024,
    eval_branch_quota: c_long = 2000000,
    optimize: Optimize = .debug,
    arch: Arch = .this,
    platform: Platform = .this,
    quiet: bool = false,
    ignore_build_file: bool = false,
    omit_functions: bool = false,
    omit_variables: bool = false,
    multithreaded: bool = true,
    persistent: bool = false,
    use_libc: bool = true,
    use_llvm: ?bool = null,
    use_redirection: bool = true,
    zig_path: [:0]const u8 = "zig",
    zig_args: [:0]const u8 = "",
    // these aren't applicable to PHP--the fields are only here so we can generate
    // the same config file as on the JavaScript side
    is_wasm: bool = false,
    max_memory: ?c_long = null,
    stack_size: c_long = 256 * 1024,
    use_pthread_emulation: bool = false,

    pub const Arch = enum {
        arm,
        arm64,
        ia32,
        loong64,
        mips,
        mipsel,
        ppc64,
        riscv64,
        s390x,
        x64,
        other,

        pub const this = switch (builtin.target.cpu.arch) {
            .arm => .arm,
            .aarch64 => .arm64,
            .x86 => .ia32,
            .loongarch64 => .loong64,
            .mips => .mips,
            .mipsel => .mipsel,
            .powerpc => .ppc,
            .powerpc64 => .ppc64,
            .powerpc64le => .ppc64,
            .riscv64 => .riscv64,
            .s390x => .s390x,
            .x86_64 => .x64,
            else => .other,
        };

        pub fn name(self: @This()) []const u8 {
            return @tagName(self);
        }

        pub fn zigName(self: @This()) []const u8 {
            return switch (self) {
                .arm => "arm",
                .arm64 => "aarch64",
                .ia32 => "x86",
                .loong64 => "loong64",
                .mips => "mips",
                .mipsel => "mipsel",
                .ppc64 => "powerpc64le",
                .riscv64 => "riscv64",
                .s390x => "s390x",
                .x64 => "x86_64",
                .other => "other",
            };
        }
    };
    pub const Platform = enum {
        darwin,
        freebsd,
        linux,
        @"linux-musl",
        openbsd,
        win32,
        other,

        pub const this = switch (builtin.target.os.tag) {
            .macos, .ios, .tvos, .visionos, .watchos => .darwin,
            .freebsd => .freebsd,
            .linux => switch (builtin.target.isMuslLibC()) {
                true => .@"linux-musl",
                false => .linux,
            },
            .openbsd => .openbsd,
            .windows => .win32,
            else => .other,
        };

        pub fn name(self: @This()) []const u8 {
            return @tagName(self);
        }

        pub fn zigName(self: @This()) []const u8 {
            return switch (self) {
                .darwin => "macos",
                .freebsd => "freebsd",
                .linux => "linux-gnu",
                .@"linux-musl" => "linux-musl",
                .openbsd => "openbsd",
                .win32 => "windows",
                else => "other",
            };
        }

        pub fn ext(self: @This()) []const u8 {
            return switch (self) {
                .darwin => "dynlib",
                .win32 => "dll",
                else => "so",
            };
        }
    };
    pub const Optimize = enum {
        debug,
        release_safe,
        release_small,
        release_fast,

        pub fn name(self: @This()) []const u8 {
            return @tagName(self);
        }

        pub const zigName = name;
    };

    var default_build_dir: [:0]const u8 = undefined;
    var ini_entries: [std.meta.fieldNames(Options).len]php.IniEntryDef = undefined;

    pub fn init() @This() {
        return .{ .build_dir = default_build_dir };
    }

    pub fn setup(module_number: c_int) !void {
        // get default build directory
        const al = std.heap.c_allocator;
        const tmp = try getTempDir(al);
        defer al.free(tmp);
        const path = try std.fs.path.resolve(al, &.{ tmp, "zigar-build" });
        defer al.free(path);
        default_build_dir = try al.dupeSentinel(u8, path, 0);
        // register init entries
        const template: @This() = .{ .build_dir = undefined };
        const struct_info = @typeInfo(@This()).@"struct";
        inline for (struct_info.field_names, 0..) |field_name, index| {
            const field_enum = @field(std.meta.FieldEnum(@This()), field_name);
            const FT = struct_info.field_types[index];
            if (field_enum == .is_wasm) break;
            const name = "zigar." ++ field_name;
            const default_value: [*:0]const u8 = switch (field_enum) {
                .build_dir => default_build_dir,
                else => switch (FT) {
                    bool => if (@field(template, field_name)) "On" else "Off",
                    ?bool => if (@field(template, field_name)) |value|
                        if (value) "On" else "Off"
                    else
                        "",
                    c_long => std.fmt.comptimePrint("{d}", .{@field(template, field_name)}),
                    ?c_long => if (@field(template, field_name)) |value|
                        std.fmt.comptimePrint("{d}", .{value})
                    else
                        "",
                    [:0]const u8 => @field(template, field_name),
                    else => switch (@typeInfo(FT)) {
                        .@"enum" => @tagName(@field(template, field_name)),
                        else => @compileError("Unrecognized type: " ++ @typeName(FT)),
                    },
                },
            };
            ini_entries[index] = .{
                .name = name.ptr,
                .name_length = name.len,
                .value = default_value,
                .value_length = @intCast(std.mem.len(default_value)),
                .modifiable = switch (field_enum) {
                    .recompile => php.INI_SYSTEM,
                    else => php.INI_ALL,
                },
                .on_modify = switch (FT) {
                    bool => onUpdateBool,
                    ?bool => onUpdateOptionalBool,
                    c_long => onUpdateLong,
                    ?c_long => onUpdateOptionalLong,
                    [:0]const u8 => onUpdateString,
                    Arch => onUpdateArch,
                    Platform => onUpdatePlatform,
                    Optimize => onUpdateOptimize,
                    LoopType => onUpdateLoopType,
                    else => unreachable,
                },
                .displayer = null,
                .mh_arg1 = @ptrFromInt(@offsetOf(@This(), field_name)),
                .mh_arg2 = null,
                .mh_arg3 = null,
            };
        }
        const result = php.registerIniEntries(&ini_entries, module_number);
        if (result != php.SUCCESS) return error.Failure;
    }

    fn getTempDir(allocator: std.mem.Allocator) ![]const u8 {
        switch (builtin.target.os.tag) {
            .windows => {
                const win32 = struct {
                    const DWORD = std.os.windows.DWORD;
                    const LPSTR = std.os.windows.LPSTR;
                    extern fn GetTempPathA(DWORD, LPSTR) callconv(.winapi) DWORD;
                };
                var buffer: [std.os.windows.MAX_PATH + 1]u8 = undefined;
                const len = win32.GetTempPathA(buffer.len, @ptrCast(&buffer));
                if (len == 0) return error.CannotGetTempDirectory;
                return try allocator.dupe(u8, buffer[0..len]);
            },
            else => {
                const names: []const [:0]const u8 = &.{ "TMPDIR", "TMP", "TEMP", "TEMPDIR" };
                const tmpdir = for (names) |name| {
                    if (std.c.getenv(name)) |value| break std.mem.sliceTo(value, 0);
                } else "/tmp";
                return try allocator.dupe(u8, tmpdir);
            },
        }
    }

    pub fn shutdown(module_number: c_int) void {
        php.unregisterIniEntries(module_number);
        std.heap.c_allocator.free(default_build_dir);
    }

    pub fn override(self: *@This(), dict: Dictionary) !void {
        @setEvalBranchQuota(2_000_000);
        var iter = try dict.iterate(.{});
        defer iter.deinit();
        while (iter.next()) |value| {
            inline for (comptime std.meta.fieldNames(@This())) |field_name| {
                const field_enum = @field(std.meta.FieldEnum(@This()), field_name);
                const name = iter.name();
                if (name.matchSlice(field_name) and field_enum != .recompile) {
                    const T = @FieldType(@This(), field_name);
                    const vk = value.kind();
                    @field(self, field_name) = extractValue(T, value) catch |err| {
                        const Error = @TypeOf(err);
                        inline for (comptime std.meta.fieldNames(Error)) |err_name| {
                            if (std.mem.eql(u8, err_name, "NotBoolean") and err == error.NotBoolean) {
                                return failure.report("option '{s}' is a boolean, received {}", .{ field_name, vk });
                            }
                            if (std.mem.eql(u8, err_name, "NotInteger") and err == error.NotInteger) {
                                return failure.report("option '{s}' is an integer, received {}", .{ field_name, vk });
                            }
                            if (std.mem.eql(u8, err_name, "NotString") and err == error.NotString) {
                                return failure.report("option '{s}' is a string, received {}", .{ field_name, vk });
                            }
                            if (std.mem.eql(u8, err_name, "NoMatching") and err == error.NoMatching and @typeInfo(T) == .@"enum") {
                                const string = value.stringify() catch N("(object)");
                                return reportBadEnum(T, N(field_name), string);
                            }
                        }
                        return err;
                    };
                    break;
                }
            }
        }
    }

    fn extractValue(comptime T: type, value: Value) !T {
        return switch (T) {
            bool => try value.getBoolean(),
            ?bool => switch (value.isNull()) {
                false => null,
                else => try value.getBoolean(),
            },
            c_long => try value.getInteger(),
            ?c_long => switch (value.isNull()) {
                false => null,
                else => try value.getInteger(),
            },
            [:0]const u8 => (try value.getString()).slice(),
            else => switch (@typeInfo(T)) {
                .@"enum" => get: {
                    const string = try value.getString();
                    break :get extractEnum(T, string);
                },
                else => @compileError("Unrecognized type: " ++ @typeName(T)),
            },
        };
    }

    fn extractEnum(comptime T: type, string: *String) !T {
        return inline for (@typeInfo(T).@"enum".field_names) |field_name| {
            if (string.matchSlice(field_name)) {
                break @field(T, field_name);
            }
        } else return error.NoMatching;
    }

    fn reportBadEnum(comptime T: type, name: *String, string: *String) error{FailureReported} {
        const list = comptime join: {
            var text: []const u8 = "";
            for (@typeInfo(T).@"enum".field_names) |field_name| {
                const quoted = "'" ++ field_name ++ "'";
                text = if (text.len == 0) quoted else text ++ ", " ++ quoted;
            }
            break :join text;
        };
        return failure.report("option '{s}' can be {s}, received: '{s}'", .{
            name.slice(),
            list,
            string.slice(),
        });
    }

    fn setValueAt(self: *@This(), comptime T: type, name: *String, offset: usize, string: *String) void {
        const address = @intFromPtr(self) + offset;
        const ptr: *T = @ptrFromInt(address);
        ptr.* = switch (T) {
            bool => string.parseBoolean(),
            ?bool => switch (string.length()) {
                0 => null,
                else => string.parseBoolean(),
            },
            c_long => string.parseInteger(),
            ?c_long => switch (string.len) {
                0 => null,
                else => string.parseInteger(),
            },
            [:0]const u8 => string.slice(),
            else => switch (@typeInfo(T)) {
                .@"enum" => extractEnum(T, string) catch {
                    return php.triggerWarning(reportBadEnum(T, name, string));
                },
                else => @compileError("Unrecognized type: " ++ @typeName(T)),
            },
        };
    }

    pub fn onUpdateBool(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt(bool, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateOptionalBool(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt(?bool, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateLong(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt(c_long, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateOptionalLong(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt(?c_long, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateString(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt([:0]const u8, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateArch(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt(Arch, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdatePlatform(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt(Platform, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateOptimize(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        extension.options.setValueAt(Optimize, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateLoopType(ini_intry: [*c]IniEntryOG, new_value_og: [*c]StringOG, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const new_value = castTo(String, new_value_og);
        const name = castTo(String, ini_intry.*.name);
        const text = new_value.slice();
        CallDispatcher.event_loop.use(text) catch return php.FAILURE;
        extension.options.setValueAt(LoopType, name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }
};
