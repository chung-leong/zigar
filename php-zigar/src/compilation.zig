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
            .ppc => "powerpc",
            .ppc64 => "powerpc64le",
            .s390 => "s390",
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

    pub fn init() @This() {
        return .{
            .arena = .init(php.allocator),
        };
    }

    pub fn deinit(self: *@This()) void {
        self.arena.deinit();
    }

    pub fn compile(self: *@This(), src_path: []const u8, mod_path: []const u8, options: *HashTable) !void {
        const config = self.createConfig(src_path, mod_path, options);
    }

    fn reset(self: *@This()) void {
        self.arena.reset();
    }

    fn allocator(self: *@This()) std.mem.Allocator {
        return self.arena.allocator();
    }

    fn createConfig(self: *@This(), src_path: []const u8, mod_path: ?[]const u8, options: ?*Value) !Config {
        const al = self.allocator();
        var config: Config = undefined;
        config.options = .init(options);
        const mod_name = std.fs.path.basename(mod_path orelse src_path);
        config.module_name = std.mem.sliceTo(mod_name, '.');
        config.module_path = src_path;
        config.module_dir = std.fs.path.dirname(src_path);
        config.module_dir.len += 1; // include separator
        // use module path to generate unique suffix
        var mod_hash: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
        std.crypto.hash.Sha1.hash(config.module_dir, &mod_hash, .{});
        const build_dir_name = try std.fmt.allocPrint(al, "{s}-{s}", .{
            if (mod_name.len > 8) mod_name[0..8] else mod_name,
            mod_hash,
        });
        config.module_build_dir = try std.fs.path.resolve(al, &.{
            config.options.build_dir,
            build_dir_name,
        });
        config.output_path = if (mod_path) |dest_path| try std.fs.path.resolve(al, &.{
            dest_path,
            try getSharedLibraryName(al, config.platform, config.arch),
        }) else try std.fs.path.resolve(al, &.{
            // save output in build folder; it'll be moved or deleted by caller
            config.module_build_dir,
            config.optimize.name(),
            try std.fmt.allocPrint(al, "{s}.wasm", .{mod_name}),
        });
        config.pdb_path = if (config.platform == .win32) try std.fs.path.resolve(al, &.{
            config.output_path,
            try std.fmt.allocPrint(al, "{s}.{s}.pdb", .{ config.platform.name(), config.arch.name() }),
        }) else null;
        // parse user-supplied argument list
        var need_build_cmd = true;
        var need_optimize = true;
        var need_target = true;
        const arg_list: std.ArrayList([]const u8) = .empty;
        if (config.zig_args) |args| {
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
        if (need_optimize) try arg_list.append(try std.fmt.allocPrint(al, "-Doptimize={s}", .{
            config.options.optimize.name(),
        }));
        if (need_target) try arg_list.append(try std.fmt.allocPrint(al, "-Dtarget={s}-{s}", .{
            config.options.arch.zigName(),
            config.options.platform.zigName(),
        }));
        return config;
    }

    fn runCompiler(path: []const u8, args: [][]const u8) !void {}
};

pub fn getSharedLibraryName(allocator: std.mem.Allocator, platform: Platform, arch: Arch) ![]const u8 {
    return std.fmt.allocPrint(allocator, "{s}.{s}.{ext}", .{
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
    zig_args: ?[]const u8,
    build_dir: ?[]const u8,
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
            const value = php.getHashEntry(ht, field.name) catch continue;
            const T = @FieldType(self, field.name);
            @field(self, field.name) = extract(T, value) catch |err| {
                const vt = php.getType(value);
                switch (err) {
                    error.NotBoolean => {
                        php.throwExceptionFmt("option '{s}' is a boolean, received {}", .{ field.name, vt });
                    },
                    error.NotLong => {
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
                    error.NoMatching => {
                        php.throwExceptionFmt("'{s}' is not a valid option for '{s}', which needs to be one of the following: {s}", .{
                            php.getValueStringContent(value) catch unreachable,
                            field.name,
                            T.names(),
                        });
                    },
                }
            };
        }
        return self;
    }

    pub fn extract(comptime T: type, value: *Value) !T {
        return switch (@typeInfo(T)) {
            .bool => try php.getValueBool(value),
            .int => try php.getValueUlong(value),
            .pointer => try php.getValueStringContent(value),
            .optional => |opt| extract(opt.child, value),
            .@"enum" => |en| get: {
                const s = try php.getValueStringContent(value);
                break :get inline for (comptime en.fields) |field| {
                    if (std.mem.eql(u8, s, field.name)) break @field(T, field.name);
                } else error.NoMatching;
            },
        };
    }
};

pub const Config = struct {
    options: Options,
    module_name: []const u8,
    module_path: []const u8,
    module_dir: []const u8,
    module_build_dir: []const u8,
    zigar_src_path: []const u8,
    extra_file_path: ?[]const u8,
    output_path: []const u8,
    pdb_path: ?[]const u8,
    zig_path: []const u8,
    zig_args: [][]const u8,
};

fn comptimeImplode(comptime delim: []const u8, items: anytype, stringify: anytype) []const u8 {
    return comptime join: {
        var list: []const u8 = "";
        for (items) |item| {
            const s = "'" ++ stringify(item) ++ "'";
            list = if (list.len == 0) s else list ++ delim ++ s;
        }
        const array = init: {
            var buffer: [list.len]u8 = undefined;
            @memcpy(&buffer, list);
            break :init buffer;
        };
        break :join &array;
    };
}
