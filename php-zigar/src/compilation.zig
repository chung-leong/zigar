const std = @import("std");
const builtin = @import("builtin");

const php = @import("php.zig");
const HashTable = php.HashTable;
const Value = php.Value;

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

    pub fn names() []const u8 {
        return comptime implode: {
            const fields = std.meta.fields(@This());
            var items: [fields.len - 1]@This() = undefined;
            for (fields[0 .. fields.len - 1], 0..) |field, i|
                items[i] = @field(@This(), field.name);
            break :implode comptimeImplode(", ", items, name);
        };
    }

    pub const default = this;
    pub const this: @This() = switch (builtin.target.cpu.arch) {
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

    pub fn names() []const u8 {
        return comptime implode: {
            const fields = std.meta.fields(@This());
            var items: [fields.len - 1]@This() = undefined;
            for (fields[0 .. fields.len - 1], 0..) |field, i|
                items[i] = @field(@This(), field.name);
            break :implode comptimeImplode(", ", items, name);
        };
    }

    pub fn ext(self: @This()) []const u8 {
        return switch (self) {
            .darwin => "dynlib",
            .win32 => "dll",
            else => "so",
        };
    }

    pub const default = this;
    pub const this: @This() = switch (builtin.target.os.tag) {
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
};
pub const Optimize = enum {
    debug,
    release_safe,
    release_small,
    release_fast,

    pub fn name(self: @This()) []const u8 {
        return switch (self) {
            .debug => "Debug",
            .release_safe => "ReleaseSafe",
            .release_small => "ReleaseSmall",
            .release_fast => "ReleaseFast",
        };
    }

    pub fn names() []const u8 {
        return comptime implode: {
            const fields = std.meta.fields(@This());
            var items: [fields.len]@This() = undefined;
            for (fields, 0..) |field, i|
                items[i] = @field(@This(), field.name);
            break :implode comptimeImplode(", ", items, name);
        };
    }

    pub const default = .debug;
};

pub const ZigCompiler = struct {
    arena: std.heap.ArenaAllocator,

    const Config = struct {
        options: Options,
        module_name: []const u8,
        module_path: []const u8,
        module_dir: []const u8,
        module_build_dir: []const u8,
        zigar_src_path: []const u8,
        build_file_path: []const u8,
        package_config_path: ?[]const u8,
        extra_file_path: ?[]const u8,
        output_path: []const u8,
        pdb_path: ?[]const u8,
        zig_args: [][]const u8,
    };

    pub fn compile(src_path: []const u8, mod_path: []const u8, options: ?*Value) !void {
        var self: @This() = .{ .arena = .init(php.allocator) };
        defer self.arena.deinit();
        const cfg = try self.createConfig(src_path, mod_path, options);
        try self.createProject(cfg);
        try self.createZigarLib(cfg);
    }

    fn reset(self: *@This()) void {
        self.arena.reset();
    }

    fn allocator(self: *@This()) std.mem.Allocator {
        return self.arena.allocator();
    }

    fn createConfig(self: *@This(), src_path: []const u8, mod_path: ?[]const u8, options: ?*Value) !Config {
        const al = self.allocator();
        var cfg: Config = undefined;
        cfg.options = try .init(options);
        const mod_name = std.fs.path.basename(mod_path orelse src_path);
        cfg.module_name = std.mem.sliceTo(mod_name, '.');
        cfg.module_path = src_path;
        const src_dir_path = std.fs.path.dirname(src_path) orelse return error.InvalidPath;
        cfg.module_dir = try std.fmt.allocPrint(al, "{s}{c}", .{ src_dir_path, std.fs.path.sep });
        // use module path to generate unique suffix
        var mod_hash: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
        std.crypto.hash.Sha1.hash(cfg.module_dir, &mod_hash, .{});
        const build_dir_name = try std.fmt.allocPrint(al, "{s}-{s}", .{
            if (mod_name.len > 8) mod_name[0..8] else mod_name,
            &mod_hash,
        });
        const build_dir_parent = cfg.options.build_dir orelse try std.fs.path.resolve(al, &.{
            try getTempDir(al),
            "zigar-build",
        });
        cfg.module_build_dir = try std.fs.path.resolve(al, &.{ build_dir_parent, build_dir_name });
        cfg.zigar_src_path = try std.fs.path.resolve(al, &.{ build_dir_parent, "zigar" });
        cfg.output_path = if (mod_path) |dest_path| try std.fs.path.resolve(al, &.{
            dest_path,
            try getSharedLibraryName(al, cfg.options.platform, cfg.options.arch),
        }) else try std.fs.path.resolve(al, &.{
            // save output in build folder; it'll be moved or deleted by caller
            cfg.module_build_dir,
            cfg.options.optimize.name(),
            try std.fmt.allocPrint(al, "{s}.wasm", .{mod_name}),
        });
        cfg.pdb_path = if (cfg.options.platform == .win32) try std.fs.path.resolve(al, &.{
            cfg.output_path,
            try std.fmt.allocPrint(al, "{s}.{s}.pdb", .{ cfg.options.platform.name(), cfg.options.arch.name() }),
        }) else null;
        // parse user-supplied argument list
        var need_build_cmd = true;
        var need_optimize = true;
        var need_target = true;
        var arg_list: std.ArrayList([]const u8) = .empty;
        if (cfg.options.zig_args) |args| {
            var splitter = std.mem.splitScalar(u8, args, ' ');
            while (splitter.next()) |arg| {
                if (arg.len == 0) continue;
                if (arg[0] == '-') {
                    if (std.mem.startsWith(u8, arg, "-Doptimize="))
                        need_optimize = false
                    else if (std.mem.startsWith(u8, arg, "-Dtarget="))
                        need_target = false;
                } else {
                    need_build_cmd = false;
                }
            }
        }
        if (need_build_cmd) try arg_list.insert(al, 0, "build");
        if (need_optimize) try arg_list.append(al, try std.fmt.allocPrint(al, "-Doptimize={s}", .{
            cfg.options.optimize.name(),
        }));
        if (need_target) try arg_list.append(al, try std.fmt.allocPrint(al, "-Dtarget={s}-{s}", .{
            cfg.options.arch.zigName(),
            cfg.options.platform.zigName(),
        }));
        try arg_list.insert(al, 0, cfg.options.zig_path);
        // use custom build file if it exists; otherwise use Zigar's own build file
        cfg.build_file_path = try findFile(al, src_dir_path, "build.zig") orelse try std.fs.path.resolve(al, &.{
            cfg.zigar_src_path,
            "build.zig",
        });
        cfg.extra_file_path = try findFile(al, src_dir_path, "build.extra.zig");
        cfg.package_config_path = try findFile(al, src_dir_path, "build.zig.zon");
        return cfg;
    }

    fn createProject(self: *@This(), cfg: Config) !void {
        const al = self.allocator();
        try makeDirectory(cfg.module_build_dir);
        try self.createZigarLib(cfg);
        try self.createBuildConfigFile(cfg);
        const build_file_path = try std.fs.path.resolve(al, &.{
            cfg.module_build_dir,
            "build.zig",
        });
        try std.fs.copyFileAbsolute(cfg.build_file_path, build_file_path, .{});
        if (cfg.extra_file_path) |path| {
            const build_extra_file_path = try std.fs.path.resolve(al, &.{
                cfg.module_build_dir,
                "build.extra.zig",
            });
            try std.fs.copyFileAbsolute(path, build_extra_file_path, .{});
        }
        if (cfg.package_config_path) |path| {
            const package_config_path = try std.fs.path.resolve(al, &.{
                cfg.module_build_dir,
                "build.zig.zon",
            });
            try std.fs.copyFileAbsolute(path, package_config_path, .{});
        }
    }

    fn createBuildConfigFile(self: *@This(), cfg: Config) !void {
        const al = self.allocator();
        const config_path = try std.fs.path.resolve(al, &.{
            cfg.module_build_dir,
            "build.cfg.zig",
        });
        var file = try std.fs.createFileAbsolute(config_path, .{});
        defer file.close();
        var buffer: [1024]u8 = undefined;
        var writer = file.writer(&buffer);
        const wi = &writer.interface;
        const cfg_fields = .{
            .module_name,
            .module_path,
            .module_dir,
            .output_path,
            .pdb_path,
            .zigar_src_path,
            .use_libc,
            .use_llvm,
            .use_pthread_emulation,
            .use_redirection,
            .is_wasm,
            .multithreaded,
            .stack_size,
            .max_memory,
            .eval_branch_quota,
            .omit_functions,
            .omit_variables,
        };
        inline for (cfg_fields) |field_tag| {
            const name = @tagName(field_tag);
            const field_value = switch (@hasField(Options, name)) {
                true => @field(cfg.options, name),
                false => @field(cfg, name),
            };
            try wi.print("pub const {s} = ", .{name});
            try std.zon.stringify.serialize(field_value, .{
                .emit_strings_as_containers = true,
            }, wi);
            try wi.print(";\n", .{});
        }
    }

    fn createZigarLib(_: *@This(), cfg: Config) !void {
        var input: std.Io.Reader = .fixed(@embedFile("./zig.tar.zstd"));
        var buffer: [std.compress.zstd.default_window_len]u8 = undefined;
        var decompressor: std.compress.zstd.Decompress = .init(&input, &buffer, .{});
        var dir = try std.fs.openDirAbsolute(cfg.zigar_src_path, .{});
        defer dir.close();
        try std.tar.pipeToFileSystem(dir, &decompressor.reader, .{});
    }

    fn runCompiler(_: *@This(), cfg: Config) !void {
        for (cfg.zig_args) |arg| {
            std.debug.print("{s}\n", .{arg});
        }
    }
};

pub fn getSharedLibraryName(allocator: std.mem.Allocator, platform: Platform, arch: Arch) ![]const u8 {
    return std.fmt.allocPrint(allocator, "{s}.{s}.{s}", .{
        platform.name(),
        arch.name(),
        platform.ext(),
    });
}

pub const Options = struct {
    arch: Arch = .default,
    platform: Platform = .default,
    optimize: Optimize = .default,
    zig_path: []const u8 = "zig",
    zig_args: ?[]const u8 = null,
    build_dir: ?[]const u8 = null,
    build_dir_size: usize = 4294967296,
    clean: bool = false,
    use_libc: bool = true,
    use_llvm: ?bool = null,
    use_redirection: bool = true,
    use_pthread_emulation: bool = false,
    is_wasm: bool = false,
    multithreaded: bool = true,
    omit_functions: bool = false,
    omit_variables: bool = false,
    ignore_build_file: bool = false,
    stack_size: usize = 256 * 1024,
    max_memory: ?usize = null,
    eval_branch_quota: usize = 2000000,

    pub fn init(options: ?*Value) !@This() {
        var self: @This() = .{};
        const ht = try php.getValueHashTable(options orelse return self);
        inline for (comptime std.meta.fields(@This())) |field| {
            if (php.getHashEntry(ht, field.name)) |value| {
                const T = @FieldType(@This(), field.name);
                @field(self, field.name) = extract(T, value) catch |err| {
                    const vt = php.getType(value);
                    switch (err) {
                        error.NotBoolean => {
                            php.throwExceptionFmt("option '{s}' is a boolean, received {}", .{ field.name, vt });
                        },
                        error.NotInteger => {
                            php.throwExceptionFmt("option '{s}' is an integer, received {}", .{ field.name, vt });
                        },
                        error.NotString => {
                            php.throwExceptionFmt("option '{s}' is a string, received {}", .{ field.name, vt });
                        },
                        error.NegativeValue => {
                            php.throwExceptionFmt("option '{s}' is a positive integer, received {}", .{
                                field.name,
                                php.getValueLong(value) catch unreachable,
                            });
                        },
                        error.NoMatching => if (@typeInfo(T) == .@"enum") {
                            php.throwExceptionFmt("'{s}' is not a valid option for '{s}', which should be one of the following: {s}", .{
                                php.getValueStringContent(value) catch unreachable,
                                field.name,
                                T.names(),
                            });
                        },
                    }
                    return error.ExceptionThrown;
                };
            } else |_| {}
        }
        return self;
    }

    const ExtractionError = error{
        NotBoolean,
        NotInteger,
        NotString,
        NegativeValue,
        NoMatching,
    };

    pub fn extract(comptime T: type, value: *Value) ExtractionError!T {
        return switch (@typeInfo(T)) {
            .bool => try php.getValueBool(value),
            .int => try php.getValueUlong(value),
            .pointer => try php.getValueStringContent(value),
            .optional => |opt| try extract(opt.child, value),
            .@"enum" => |en| get: {
                const s = try php.getValueStringContent(value);
                break :get inline for (comptime en.fields) |field| {
                    if (std.mem.eql(u8, s, field.name)) break @field(T, field.name);
                } else error.NoMatching;
            },
            else => unreachable,
        };
    }
};

fn comptimeImplode(comptime delim: []const u8, items: anytype, stringify: anytype) []const u8 {
    return comptime join: {
        var list: []const u8 = "";
        for (items) |item| {
            const s = "'" ++ stringify(item) ++ "'";
            list = if (list.len == 0) s else list ++ delim ++ s;
        }
        break :join list;
    };
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
            const len = win32.GetTempPathA(buffer.len, &buffer);
            if (len == 0) return error.CannotGetTempDirectory;
            return try allocator.dupe(u8, buffer[0..len]);
        },
        else => {
            const names: []const []const u8 = &.{ "TMPDIR", "TMP", "TEMP", "TEMPDIR" };
            const tmpdir = for (names) |name| {
                if (std.posix.getenv(name)) |value| break value;
            } else "/tmp";
            return try allocator.dupe(u8, tmpdir);
        },
    }
}

fn makeDirectory(path: []const u8) !void {
    std.fs.makeDirAbsolute(path) catch |err| {
        return switch (err) {
            error.PathAlreadyExists => {},
            error.NotDir => makeDirectory(std.fs.path.dirname(path) orelse return err),
            else => err,
        };
    };
}

fn findFile(allocator: std.mem.Allocator, parent_path: []const u8, file_name: []const u8) !?[]const u8 {
    var dir = std.fs.openDirAbsolute(parent_path, .{}) catch return null;
    defer dir.close();
    const stat = dir.statFile(file_name) catch return null;
    if (stat.kind != .file) return null;
    return try std.fs.path.resolve(allocator, &.{ parent_path, file_name });
}
