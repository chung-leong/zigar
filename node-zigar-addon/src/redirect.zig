const std = @import("std");
const builtin = @import("builtin");

pub const Callback = *const fn ([*]const u8, usize) callconv(.c) u32;

extern fn find_hook([*:0]const u8) callconv(.c) ?*const anyopaque;
extern fn set_override(Callback) void;

const ns = switch (builtin.target.os.tag) {
    .linux => linux,
    .driverkit, .ios, .macos, .tvos, .visionos, .watchos => darwin,
    .windows => windows,
    else => unknown,
};
pub const redirectIO = ns.redirectIO;

const linux = struct {
    const elf = std.elf;
    const bits = @bitSizeOf(usize);
    const Elf_Ehdr = if (bits == 64) elf.Elf64_Ehdr else elf.Elf32_Ehdr;
    const Elf_Phdr = if (bits == 64) elf.Elf64_Phdr else elf.Elf32_Phdr;
    const Elf_Shdr = if (bits == 64) elf.Elf64_Shdr else elf.Elf32_Shdr;
    const Elf_Sym = if (bits == 64) elf.Elf64_Sym else elf.Elf32_Sym;
    const Elf_Rel = if (bits == 64) elf.Elf64_Rela else elf.Elf32_Rel;

    fn redirectIO(lib: *std.DynLib, path: []const u8, cb: Callback) !void {
        var sfb = std.heap.stackFallback(4096, std.heap.c_allocator);
        const allocator = sfb.get();
        const page_size = std.heap.pageSize();
        const file = try std.fs.openFileAbsolute(path, .{});
        // read ELF header
        const header = try readStruct(Elf_Ehdr, allocator, file);
        defer allocator.destroy(header);
        try file.seekTo(header.e_phoff);
        const segments = try readStructs(Elf_Phdr, allocator, file, header.e_phnum);
        defer allocator.free(segments);
        try file.seekTo(header.e_shoff);
        const sections = try readStructs(Elf_Shdr, allocator, file, header.e_shnum);
        defer allocator.free(sections);
        // find symbol table
        const dynsym = for (sections) |s| {
            if (s.sh_type == elf.SHT_DYNSYM) break s;
        } else return error.Unexpected;
        const symbol_count = dynsym.sh_size / @sizeOf(Elf_Sym);
        try file.seekTo(dynsym.sh_offset);
        const symbols = try readStructs(Elf_Sym, allocator, file, symbol_count);
        defer allocator.free(symbols);
        // get string table
        const link = sections[dynsym.sh_link];
        try file.seekTo(link.sh_offset);
        const symbol_strs = try readStructs(u8, allocator, file, link.sh_size);
        defer allocator.free(symbol_strs);
        // find base address of library
        const base_address = for (symbols) |s| {
            const binding = s.st_bind();
            if ((binding == elf.STB_GLOBAL or binding == elf.STB_WEAK) and s.st_value != 0) {
                const symbol_name_ptr: [*:0]u8 = @ptrCast(&symbol_strs[s.st_name]);
                const symbol_name_len = std.mem.len(symbol_name_ptr);
                const symbol_name: [:0]u8 = @ptrCast(symbol_name_ptr[0..symbol_name_len]);
                if (lib.lookup(*anyopaque, symbol_name)) |symbol| {
                    break @intFromPtr(symbol) - s.st_value;
                }
            }
        } else return error.Unexpected;
        // scan through relocations
        for (sections) |s| {
            const sh_type = if (bits == 64) elf.SHT_RELA else elf.SHT_REL;
            if (s.sh_type != sh_type) continue;
            const rela_entry_ptr: [*]Elf_Rel = @ptrFromInt(base_address + s.sh_addr);
            const rela_entry_count = s.sh_size / @sizeOf(Elf_Rel);
            const rela_entries = rela_entry_ptr[0..rela_entry_count];
            for (rela_entries) |r| {
                const symbol_index = r.r_sym();
                if (symbol_index == 0) continue;
                const symbol = symbols[symbol_index];
                const symbol_name: [*:0]u8 = @ptrCast(&symbol_strs[symbol.st_name]);
                const hook = find_hook(symbol_name) orelse continue;
                const address = base_address + r.r_offset;
                const ptr: **const anyopaque = @ptrFromInt(address);
                if (ptr.* != hook) {
                    // get protection flags from segment load commands
                    var read_only = false;
                    for (segments) |seg| {
                        if (seg.p_vaddr <= r.r_offset and r.r_offset < seg.p_vaddr + seg.p_memsz) {
                            read_only = (seg.p_flags & elf.PF_W) == 0;
                        }
                    }
                    if (read_only) {
                        const page_address = std.mem.alignBackward(usize, address, page_size);
                        const page_ptr: [*]align(std.heap.page_size_min) u8 = @ptrFromInt(page_address);
                        const page = page_ptr[0..page_size];
                        try std.posix.mprotect(page, std.posix.PROT.READ | std.posix.PROT.WRITE);
                        defer std.posix.mprotect(page, std.posix.PROT.READ) catch {};
                        ptr.* = hook;
                    } else {
                        ptr.* = hook;
                    }
                }
            }
        }
        set_override(cb);
    }
};

const darwin = struct {};

const windows = struct {};

const unknown = struct {
    fn redirectIO(_: anyopaque, _: []const u8, _: Callback) void {}
};

fn readStructs(comptime T: type, allocator: std.mem.Allocator, file: std.fs.File, count: usize) ![]T {
    const buffer = try allocator.alloc(T, count);
    errdefer allocator.free(buffer);
    const len = @sizeOf(T) * count;
    const bytes: [*]u8 = @ptrCast(buffer.ptr);
    if (try file.read(bytes[0..len]) != len) return error.Unexpected;
    return buffer;
}

fn readStruct(comptime T: type, allocator: std.mem.Allocator, file: std.fs.File) !*T {
    const structs = try readStructs(T, allocator, file, 1);
    return &structs[0];
}
