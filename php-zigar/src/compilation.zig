const std = @import("std");
const builtin = @import("builtin");

const extension = @import("extension.zig");
const failure = @import("failure.zig");
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
    options: Options,
    module_name: []const u8,
    module_path: []const u8,
    module_dir: []const u8,
    module_dir_wo_sep: []const u8,
    module_build_dir: []const u8,
    zigar_src_path: []const u8,
    zigar_src_path_wo_sep: []const u8,
    build_file_path: []const u8,
    package_config_path: ?[]const u8,
    extra_file_path: ?[]const u8,
    c_header_path: ?[]const u8,
    output_path: []const u8,
    pdb_path: ?[]const u8,
    compiler_args: [][]const u8,

    pub fn compile(src_path: []const u8, mod_path: []const u8, options: ?*HashTable) !void {
        var self: @This() = undefined;
        self.arena = .init(php.allocator);
        defer self.arena.deinit();
        try self.acquireConfig(src_path, mod_path, options);
        try self.writeProject();
        try self.runCompiler();
        if (self.options.clean) {
            try self.deleteModuleBuildDirectory();
        }
        self.cleanBuildDirectory() catch {};
    }

    pub fn reset(self: *@This()) void {
        self.arena.reset();
    }

    fn allocator(self: *@This()) std.mem.Allocator {
        return self.arena.allocator();
    }

    fn acquireConfig(self: *@This(), src_path: []const u8, mod_path: []const u8, options: ?*HashTable) !void {
        const al = self.allocator();
        self.options = try .init(options);
        const mod_name = std.fs.path.stem(mod_path);
        self.module_name = mod_name;
        self.module_path = src_path;
        self.module_dir_wo_sep = std.fs.path.dirname(src_path) orelse return error.InvalidPath;
        self.module_dir = try std.fmt.allocPrint(al, "{s}{c}", .{
            self.module_dir_wo_sep,
            std.fs.path.sep,
        });
        // use module path to generate unique suffix
        var mod_hash: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
        std.crypto.hash.Sha1.hash(self.module_dir, &mod_hash, .{});
        const mod_sig = std.fmt.bytesToHex(mod_hash, .lower);
        const build_dir_name = try std.fmt.allocPrint(al, "{s}-{s}", .{
            if (self.module_name.len > 8) self.module_name[0..8] else self.module_name,
            mod_sig[0..8],
        });
        self.module_build_dir = try std.fs.path.resolve(al, &.{ self.options.build_dir, build_dir_name });
        self.zigar_src_path_wo_sep = try std.fs.path.resolve(al, &.{ self.module_build_dir, "zigar" });
        self.zigar_src_path = try std.fmt.allocPrint(al, "{s}{c}", .{
            self.zigar_src_path_wo_sep,
            std.fs.path.sep,
        });
        self.output_path = try getSharedLibraryPath(al, mod_path, self.options.platform, self.options.arch);
        self.pdb_path = if (self.options.platform == .win32) try std.fs.path.resolve(al, &.{
            mod_path,
            try std.fmt.allocPrint(al, "{s}.pdb", .{std.fs.path.stem(self.output_path)}),
        }) else null;
        // parse user-supplied argument list
        var need_build_cmd = true;
        var need_optimize = true;
        var need_target = true;
        var arg_list: std.ArrayList([]const u8) = .empty;
        var splitter = std.mem.splitScalar(u8, self.options.zig_args, ' ');
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
        if (need_build_cmd) try arg_list.insert(al, 0, "build");
        if (need_optimize) try arg_list.append(al, try std.fmt.allocPrint(al, "-Doptimize={s}", .{
            self.options.optimize.name(),
        }));
        if (need_target) try arg_list.append(al, try std.fmt.allocPrint(al, "-Dtarget={s}-{s}", .{
            self.options.arch.zigName(),
            self.options.platform.zigName(),
        }));
        try arg_list.insert(al, 0, self.options.zig_path);
        self.compiler_args = arg_list.items;
        // use custom build file if it exists; otherwise use Zigar's own build file
        self.build_file_path = find: {
            if (findFile(al, self.module_dir_wo_sep, "build.zig") catch null) |path| {
                const path_z = try php.allocator.dupeZ(u8, path);
                defer php.allocator.free(path_z);
                // make sure it's not empty
                var tree = std.zig.Ast.parse(php.allocator, path_z, .zig) catch {
                    // use the path if there's a syntax error so that the user would know
                    break :find path;
                };
                defer tree.deinit(php.allocator);
                const decls = tree.rootDecls();
                if (decls.len > 0) break :find path;
            }
            // use the built-in build file
            break :find try std.fs.path.resolve(al, &.{ self.zigar_src_path_wo_sep, "build.zig" });
        };
        self.extra_file_path = try findFile(al, self.module_dir_wo_sep, "build.extra.zig");
        self.c_header_path = try findFile(al, self.module_dir_wo_sep, "build.extra.h");
        self.package_config_path = try findFile(al, self.module_dir_wo_sep, "build.zig.zon");
    }

    fn writeProject(self: *@This()) !void {
        const al = self.allocator();
        // std.fs.deleteTreeAbsolute(self.module_build_dir) catch {};
        try makeDirectory(self.module_build_dir);
        try self.writeZigarLib();
        try self.writeBuildConfigFile();
        const build_file_path = try std.fs.path.resolve(al, &.{
            self.module_build_dir,
            "build.zig",
        });
        try std.fs.copyFileAbsolute(self.build_file_path, build_file_path, .{});
        const build_extra_file_path = try std.fs.path.resolve(al, &.{
            self.module_build_dir,
            "build.extra.zig",
        });
        if (self.extra_file_path) |path| {
            try std.fs.copyFileAbsolute(path, build_extra_file_path, .{});
        } else {
            var file = try std.fs.createFileAbsolute(build_extra_file_path, .{});
            defer file.close();
        }
        if (self.package_config_path) |path| {
            const package_config_path = try std.fs.path.resolve(al, &.{
                self.module_build_dir,
                "build.zig.zon",
            });
            try std.fs.copyFileAbsolute(path, package_config_path, .{});
        }
    }

    fn writeBuildConfigFile(self: *@This()) !void {
        errdefer |err| std.debug.print("writeBuildConfigFile => {}\n", .{err});
        const al = self.allocator();
        const config_path = try std.fs.path.resolve(al, &.{
            self.module_build_dir,
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
            .c_header_path,
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
                true => @field(self.options, name),
                false => @field(self, name),
            };
            try wi.print("pub const {s} = ", .{name});
            try std.zon.stringify.serialize(field_value, .{}, wi);
            try wi.print(";\n", .{});
        }
        try wi.flush();
    }

    fn writeZigarLib(self: *@This()) !void {
        const signature: [:0]const u8 = @embedFile("./zig.tar.zstd.sha1");
        const has_existing = check: {
            var dir = std.fs.openDirAbsolute(self.zigar_src_path, .{}) catch break :check false;
            const match = if (dir.openFile(".sha1", .{})) |file| compare: {
                defer file.close();
                var read_buffer: [64]u8 = undefined;
                var reader = file.reader(&read_buffer);
                const ri = &reader.interface;
                var bytes: [41]u8 = undefined;
                ri.readSliceAll(&bytes) catch break :compare false;
                break :compare std.mem.eql(u8, signature, &bytes);
            } else |_| false;
            dir.close();
            if (match) {
                break :check true;
            } else {
                std.fs.deleteTreeAbsolute(self.zigar_src_path) catch {};
            }
            break :check false;
        };
        if (has_existing) return;
        try makeDirectory(self.zigar_src_path);
        var input: std.Io.Reader = .fixed(@embedFile("./zig.tar.zstd"));
        const buffer: []u8 = try php.allocator.alloc(u8, std.compress.zstd.default_window_len);
        defer php.allocator.free(buffer);
        var decompressor: std.compress.zstd.Decompress = .init(&input, buffer, .{});
        var dir = try std.fs.openDirAbsolute(self.zigar_src_path, .{});
        defer dir.close();
        try std.tar.pipeToFileSystem(dir, &decompressor.reader, .{});
        const file = try dir.createFile(".sha1", .{});
        defer file.close();
        var write_buffer: [64]u8 = undefined;
        var writer = file.writer(&write_buffer);
        const wi = &writer.interface;
        _ = try wi.write(signature);
        try wi.flush();
    }

    fn runCompiler(self: *@This()) !void {
        const al = self.allocator();
        var child: std.process.Child = .init(self.compiler_args, al);
        child.cwd = self.module_build_dir;
        child.stderr_behavior = .Pipe;
        child.stdout_behavior = .Pipe;
        try child.spawn();
        try child.waitForSpawn();
        const max_output = 8 * 1024 * 1024;
        var finished: std.atomic.Value(u32) = .init(0);
        const thread = try std.Thread.spawn(.{}, showProgress, .{ self, &finished });
        defer {
            finished.store(1, .unordered);
            thread.join();
        }
        var stdout: std.ArrayList(u8) = .empty;
        var stderr: std.ArrayList(u8) = .empty;
        child.collectOutput(al, &stdout, &stderr, max_output) catch {};
        const term = try child.wait();
        return switch (term) {
            .Exited => |exit_code| switch (exit_code) {
                0 => {},
                else => failure.report("unable to create module '{s}':\n\n{s}", .{
                    self.module_name,
                    stderr.items,
                }),
            },
            .Stopped => error.CompilerStopped,
            .Signal => error.CompilerInterrupted,
            .Unknown => error.UnknownError,
        };
    }

    fn deleteModuleBuildDirectory(self: *@This()) !void {
        try std.fs.deleteTreeAbsolute(self.module_build_dir);
    }

    fn cleanBuildDirectory(self: *@This()) !void {
        // get the size and mtime of all sub-directories
        const al = self.allocator();
        const SubDir = struct {
            name: []const u8,
            mtime: i128,
            size: u64,

            fn isOlder(_: void, a: @This(), b: @This()) bool {
                return a.mtime < b.mtime;
            }
        };
        var sub_dir_list: std.ArrayList(SubDir) = .empty;
        var build_dir = try std.fs.openDirAbsolute(self.options.build_dir, .{ .iterate = true });
        defer build_dir.close();
        var build_dir_size: u64 = 0;
        var build_dir_iter = build_dir.iterateAssumeFirstIteration();
        while (try build_dir_iter.next()) |entry| {
            if (entry.kind != .directory) continue;
            var sub_dir = try build_dir.openDir(entry.name, .{ .iterate = true });
            defer sub_dir.close();
            var sub_dir_size: u64 = 0;
            var walker = try sub_dir.walk(al);
            defer walker.deinit();
            while (try walker.next()) |sub_entry| {
                if (sub_entry.kind != .file) continue;
                const sub_entry_info = try sub_entry.dir.statFile(sub_entry.basename);
                sub_dir_size += sub_entry_info.size;
            }
            const sub_dir_info = try sub_dir.stat();
            try sub_dir_list.append(al, .{
                .name = try al.dupe(u8, entry.name),
                .size = sub_dir_size,
                .mtime = sub_dir_info.mtime,
            });
            build_dir_size += sub_dir_size;
        }
        if (build_dir_size < self.options.build_dir_size) return;
        // remove sub-directories until we lower the size to below the specified number
        std.mem.sort(SubDir, sub_dir_list.items, {}, SubDir.isOlder);
        for (sub_dir_list.items) |item| {
            build_dir.deleteTree(item.name) catch continue;
            if (build_dir_size < self.options.build_dir_size) break;
        }
    }

    fn showProgress(self: *@This(), finished: *std.atomic.Value(u32)) !void {
        // don't print anything if stderr isn't a tty or doesn't support ANSI sequences
        if (!std.fs.File.stderr().getOrEnableAnsiEscapeSupport()) return;
        if (builtin.target.os.tag != .windows) {
            // don't print anything if env variable is missing
            if (std.posix.getenvZ("TERM") == null) return;
        }
        var message_buffer: [4096]u8 = undefined;
        const fmt = "Building module \"{s}\" at optimization level \"{s}\" ({s}/{s})";
        const message = try std.fmt.bufPrint(&message_buffer, fmt, .{
            self.module_name,
            self.options.optimize.name(),
            @tagName(self.options.platform),
            @tagName(self.options.arch),
        });
        const status_characters = [_][]const u8{ "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" };
        var index: usize = 0;
        while (finished.load(.unordered) == 0) {
            std.debug.print("\r\x1b[33m{s}\x1b[0m {s}", .{ status_characters[index], message });
            if (std.Thread.Futex.timedWait(finished, 0, 150_000_000) == error.Timeout) {
                index += 1;
                if (index >= status_characters.len) index = 0;
            }
        }
        std.debug.print("\r\x1b[K", .{});
    }

    pub extern "c" var __environ: [*:null]?[*:0]u8;
};

pub fn getSharedLibraryPath(allocator: std.mem.Allocator, mod_path: []const u8, platform: Platform, arch: Arch) ![]const u8 {
    var buffer: [1024]u8 = undefined;
    const so_filename = try std.fmt.bufPrint(&buffer, "{s}.{s}.{s}", .{ platform.name(), arch.name(), platform.ext() });
    return try std.fs.path.resolve(allocator, &.{ mod_path, so_filename });
}

pub const Options = struct {
    zig_path: []const u8,
    zig_args: []const u8,
    build_dir: []const u8,
    build_dir_size: u64,
    clean: bool,
    arch: Arch = .default,
    platform: Platform = .default,
    optimize: Optimize = .default,
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

    pub fn init(options: ?*HashTable) !@This() {
        var self: @This() = .{
            .zig_path = std.mem.sliceTo(extension.options.zig_path, 0),
            .zig_args = std.mem.sliceTo(extension.options.zig_args, 0),
            .build_dir = std.mem.sliceTo(extension.options.build_dir, 0),
            .build_dir_size = @intCast(@max(0, extension.options.build_dir_size)),
            .clean = extension.options.clean,
            .optimize = init: {
                const name = std.mem.sliceTo(extension.options.optimize, 0);
                break :init inline for (std.meta.fields(Optimize)) |field| {
                    if (std.mem.eql(u8, @field(Optimize, field.name).name(), name)) break @field(Optimize, field.name);
                } else .default;
            },
        };
        const ht = options orelse return self;
        inline for (comptime std.meta.fields(@This())) |field| {
            if (php.getHashEntry(ht, field.name) catch null) |value| {
                const T = @FieldType(@This(), field.name);
                @field(self, field.name) = extract(T, value) catch |err| {
                    const vt = php.getValueType(value);
                    return switch (err) {
                        error.NotBoolean => failure.report("option '{s}' is a boolean, received {}", .{ field.name, vt }),
                        error.NotInteger => failure.report("option '{s}' is an integer, received {}", .{ field.name, vt }),
                        error.NotString => failure.report("option '{s}' is a string, received {}", .{ field.name, vt }),
                        error.NegativeValue => failure.report("option '{s}' is a positive integer, received {}", .{
                            field.name,
                            php.getValueLong(value) catch unreachable,
                        }),
                        error.NoMatching => failure.report("'{s}' is not a valid option for '{s}'; it should be one of the following: {s}", .{
                            php.getValueStringContent(value) catch unreachable,
                            field.name,
                            if (@typeInfo(T) == .@"enum") T.names() else unreachable,
                        }),
                    };
                };
            }
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
                    const item = @field(T, field.name);
                    if (std.mem.eql(u8, s, item.name())) break @field(T, field.name);
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

fn makeDirectory(path: []const u8) !void {
    std.fs.makeDirAbsolute(path) catch |err| {
        return switch (err) {
            error.PathAlreadyExists => {},
            error.FileNotFound => {
                try makeDirectory(std.fs.path.dirname(path) orelse return err);
                try std.fs.makeDirAbsolute(path);
            },
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
