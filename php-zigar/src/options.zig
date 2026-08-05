const std = @import("std");
const builtin = @import("builtin");

const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const dyn_lib = @import("dyn-lib.zig");
const extension = @import("extension.zig");
const failure = @import("failure.zig");
const LoopType = @import("event-loop.zig").LoopType;
const php = @import("php.zig");
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const IniEntry = php.IniEntry;
const Long = php.Long;
const N = php.getStaticString;
const String = php.String;
const Value = php.Value;

pub const Options = struct {
    recompile: bool = true,
    clean: bool = false,
    event_loop: LoopType = .temporary,
    module_rel_path: [:0]const u8 = "../lib",
    build_dir: [:0]const u8,
    build_dir_size: Long = 4 * 1024 * 1024 * 1024,
    eval_branch_quota: Long = 2000000,
    optimize: Optimize = .Debug,
    arch: Arch = .this,
    platform: Platform = .this,
    quiet: bool = false,
    ignore_build_file: bool = false,
    omit_functions: bool = false,
    omit_variables: bool = false,
    multithreaded: bool = true,
    use_libc: bool = true,
    use_llvm: ?bool = null,
    use_redirection: bool = true,
    zig_path: [:0]const u8 = "zig",
    zig_args: [:0]const u8 = "",
    // these aren't applicable to PHP--the fields are only here so we can generate
    // the same config file as on the JavaScript side
    is_wasm: bool = false,
    max_memory: ?Long = null,
    stack_size: Long = 256 * 1024,
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
        aix,
        darwin,
        freebsd,
        linux,
        @"linux-musl",
        openbsd,
        sunos,
        win32,
        other,

        pub const this = switch (builtin.target.os.tag) {
            .aix => .aix,
            .macos, .ios, .tvos, .visionos, .watchos => .darwin,
            .freebsd => .freebsd,
            .linux => switch (builtin.target.isMuslLibC()) {
                true => .@"linux-musl",
                false => .linux,
            },
            .openbsd => .openbsd,
            .solaris => .sunos,
            .windows => .win32,
            else => .other,
        };

        pub fn name(self: @This()) []const u8 {
            return @tagName(self);
        }

        pub fn zigName(self: @This()) []const u8 {
            return switch (self) {
                .aix => "aix",
                .darwin => "macos",
                .freebsd => "freebsd",
                .linux => "linux-gnu",
                .@"linux-musl" => "linux-musl",
                .openbsd => "openbsd",
                .sunos => "solaris",
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
        Debug,
        ReleaseSafe,
        ReleaseSmall,
        ReleaseFast,

        pub fn name(self: @This()) []const u8 {
            return @tagName(self);
        }

        pub const zigName = name;
    };

    var default_build_dir: [:0]const u8 = undefined;
    var ini_entries: [std.meta.fields(Options).len]php.IniEntryDef = undefined;

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
        default_build_dir = try al.dupeZ(u8, path);
        // register init entries
        const template: @This() = .{ .build_dir = undefined };
        inline for (std.meta.fields(@This()), 0..) |field, index| {
            const field_enum = @field(std.meta.FieldEnum(@This()), field.name);
            if (field_enum == .is_wasm) break;
            const name = "zigar." ++ field.name;
            const default_value: [*:0]const u8 = switch (field_enum) {
                .build_dir => default_build_dir,
                else => switch (field.type) {
                    bool => if (@field(template, field.name)) "On" else "Off",
                    ?bool => if (@field(template, field.name)) |value|
                        if (value) "On" else "Off"
                    else
                        "",
                    Long => std.fmt.comptimePrint("{d}", .{@field(template, field.name)}),
                    ?Long => if (@field(template, field.name)) |value|
                        std.fmt.comptimePrint("{d}", .{value})
                    else
                        "",
                    [:0]const u8 => @field(template, field.name),
                    else => switch (@typeInfo(field.type)) {
                        .@"enum" => @tagName(@field(template, field.name)),
                        else => @compileError("Unrecognized type: " ++ @typeName(field.type)),
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
                .on_modify = switch (field.type) {
                    bool => onUpdateBool,
                    ?bool => onUpdateOptionalBool,
                    Long => onUpdateLong,
                    ?Long => onUpdateOptionalLong,
                    [:0]const u8 => onUpdateString,
                    Arch => onUpdateArch,
                    Platform => onUpdatePlatform,
                    Optimize => onUpdateOptimize,
                    LoopType => onUpdateLoopType,
                    else => unreachable,
                },
                .displayer = null,
                .mh_arg1 = @ptrFromInt(@offsetOf(@This(), field.name)),
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
                    // std.posix.getenv() crashes for some reason
                    if (std.posix.getenvZ(name)) |value| break value;
                } else "/tmp";
                return try allocator.dupe(u8, tmpdir);
            },
        }
    }

    pub fn shutdown(module_number: c_int) void {
        php.unregisterIniEntries(module_number);
        std.heap.c_allocator.free(default_build_dir);
    }

    pub fn override(self: *@This(), ht: *HashTable) !void {
        var iter: HashTableIterator = .init(ht, .{});
        while (iter.next()) |value| {
            inline for (comptime std.meta.fields(@This())) |field| {
                const field_enum = @field(std.meta.FieldEnum(@This()), field.name);
                const name = iter.currentName() orelse return error.UnexpectedIntegerKey;
                if (php.matchString(name, field.name) and field_enum != .recompile) {
                    const T = @FieldType(@This(), field.name);
                    const vt = php.getValueType(value);
                    @field(self, field.name) = extractValue(T, value) catch |err| {
                        const Error = @TypeOf(err);
                        inline for (comptime std.meta.fields(Error)) |err_field| {
                            if (std.mem.eql(u8, err_field.name, "NotBoolean") and err == error.NotBoolean) {
                                return failure.report("option '{s}' is a boolean, received {}", .{ field.name, vt });
                            }
                            if (std.mem.eql(u8, err_field.name, "NotInteger") and err == error.NotInteger) {
                                return failure.report("option '{s}' is an integer, received {}", .{ field.name, vt });
                            }
                            if (std.mem.eql(u8, err_field.name, "NotString") and err == error.NotString) {
                                return failure.report("option '{s}' is a string, received {}", .{ field.name, vt });
                            }
                            if (std.mem.eql(u8, err_field.name, "NoMatching") and err == error.NoMatching and @typeInfo(T) == .@"enum") {
                                var copy = value.*;
                                php.addRef(&copy);
                                defer php.release(&copy);
                                const string = get: {
                                    php.convertValue(&copy, .string) catch break :get N("(object)");
                                    break :get try php.getValueString(&copy);
                                };
                                return reportBadEnum(T, N(field.name), string);
                            }
                        }
                        return err;
                    };
                    break;
                }
            }
        }
    }

    fn extractValue(comptime T: type, value: *const Value) !T {
        return switch (T) {
            bool => try php.getValueBool(value),
            ?bool => switch (php.isValueNull(value)) {
                false => null,
                else => try php.getValueBool(value),
            },
            Long => try php.getValueLong(value),
            ?Long => switch (php.isValueNull(value)) {
                false => null,
                else => try php.getValueLong(value),
            },
            [:0]const u8 => try php.getValueStringContent(value),
            else => switch (@typeInfo(T)) {
                .@"enum" => get: {
                    const string = try php.getValueString(value);
                    break :get extractEnum(T, string);
                },
                else => @compileError("No recognized type: " ++ @typeName(T)),
            },
        };
    }

    fn extractEnum(comptime T: type, string: *String) !T {
        return inline for (comptime std.meta.fields(T)) |field| {
            if (php.matchString(string, field.name)) {
                break @field(T, field.name);
            }
        } else return error.NoMatching;
    }

    fn reportBadEnum(comptime T: type, name: *String, string: *String) error{FailureReported} {
        const list = comptime join: {
            var text: []const u8 = "";
            for (std.meta.fields(T)) |field| {
                const quoted = "'" ++ field.name ++ "'";
                text = if (text.len == 0) quoted else text ++ ", " ++ quoted;
            }
            break :join text;
        };
        return failure.report("option '{s}' can be {s}, received: '{s}'", .{
            php.getStringContent(name),
            list,
            php.getStringContent(string),
        });
    }

    fn setValueAt(self: *@This(), comptime T: type, name: *String, offset: usize, string: *String) void {
        const address = @intFromPtr(self) + offset;
        const ptr: *T = @ptrFromInt(address);
        ptr.* = switch (T) {
            bool => php.parseBool(string),
            ?bool => switch (string.len) {
                0 => null,
                else => php.parseBool(string),
            },
            Long => php.parseLong(string),
            ?Long => switch (string.len) {
                0 => null,
                else => php.parseLong(string),
            },
            [:0]const u8 => php.getStringContent(string),
            else => switch (@typeInfo(T)) {
                .@"enum" => extractEnum(T, string) catch {
                    return php.triggerWarning(reportBadEnum(T, name, string));
                },
                else => @compileError("No recognized type: " ++ @typeName(T)),
            },
        };
    }

    pub fn onUpdateBool(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt(bool, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateOptionalBool(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt(?bool, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateLong(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt(Long, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateOptionalLong(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt(?Long, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateString(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt([:0]const u8, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateArch(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt(Arch, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdatePlatform(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt(Platform, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateOptimize(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        extension.options.setValueAt(Optimize, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }

    pub fn onUpdateLoopType(ini_intry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, _: ?*anyopaque, _: ?*anyopaque, _: c_int) callconv(.c) c_int {
        const text = php.getStringContent(new_value);
        CallDispatcher.event_loop.use(text) catch return php.FAILURE;
        extension.options.setValueAt(LoopType, ini_intry.*.name, @intFromPtr(mh_arg1), new_value);
        return php.SUCCESS;
    }
};
