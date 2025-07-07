const std = @import("std");
const builtin = @import("builtin");

const h = @cImport({
    @cInclude("redirect.h");
});

pub const posix = @cImport({
    @cInclude("fcntl.h");
});

pub const SysCall = extern struct {
    cmd: SysCallCommand,
    u: h.syscall_union,
    futex_handle: usize,
};
pub const SysCallCommand: type = define: {
    // derive Zig enum from C enum
    @setEvalBranchQuota(100000);
    var count: usize = 0;
    var in_enum = false;
    for (std.meta.declarations(h)) |decl| {
        if (in_enum) {
            if (std.mem.startsWith(u8, decl.name, "syscall_command")) {
                in_enum = false;
            } else {
                count += 1;
            }
        } else {
            if (std.mem.startsWith(u8, decl.name, "invalid_command")) {
                in_enum = true;
            }
        }
    }
    var fields: [count]std.builtin.Type.EnumField = undefined;
    var i: usize = 0;
    for (std.meta.declarations(h)) |decl| {
        if (in_enum) {
            if (std.mem.startsWith(u8, decl.name, "syscall_command")) {
                in_enum = false;
            } else {
                fields[i] = .{
                    .name = decl.name,
                    .value = @field(h, decl.name),
                };
                i += 1;
            }
        } else {
            if (std.mem.startsWith(u8, decl.name, "invalid_command")) {
                in_enum = true;
            }
        }
    }
    break :define @Type(.{
        .@"enum" = .{
            .tag_type = c_int,
            .fields = &fields,
            .decls = &.{},
            .is_exhaustive = true,
        },
    });
};
pub const Callback = *const fn (*SysCall) callconv(.c) u32;

extern fn find_hook([*:0]const u8) callconv(.c) ?*const anyopaque;
extern fn set_override(?Callback) void;

const ns = switch (builtin.target.os.tag) {
    .linux => linux,
    .driverkit, .ios, .macos, .tvos, .visionos, .watchos => darwin,
    .windows => windows,
    else => unknown,
};
pub const redirectIO = ns.redirectIO;

pub fn stop() void {
    set_override(null);
}

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
        defer file.close();
        // read ELF header
        const header = try readStruct(Elf_Ehdr, file);
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

const darwin = struct {
    const macho = std.macho;
    const bits = @bitSizeOf(usize);
    const MachHeader = if (bits == 64) macho.mach_header_64 else macho.mach_header;
    const LoadCommand = macho.load_command;
    const SymtabCommand = macho.symtab_command;
    const DyldInfoCommand = macho.dyld_info_command;
    const SegmentCommand = if (bits == 64) macho.segment_command_64 else macho.segment_command;
    const NList = if (bits == 64) macho.nlist_64 else macho.nlist;

    fn redirectIO(lib: *std.DynLib, path: []const u8, cb: Callback) !void {
        var sfb = std.heap.stackFallback(4096, std.heap.c_allocator);
        const allocator = sfb.get();
        const page_size = std.heap.pageSize();
        const file = try std.fs.openFileAbsolute(path, .{});
        defer file.close();
        const header = try readStruct(MachHeader, file);
        // process mach-o commands
        const DataSegment = struct {
            index: usize,
            offset: usize,
            read_only: bool,
        };
        var data_segment_buffer: [8]DataSegment = undefined;
        var data_segments: []DataSegment = data_segment_buffer[0..0];
        var symbols: []NList = &.{};
        var symbol_strs: []const u8 = "";
        const Binding = struct {
            offset: usize,
            size: usize,
            byte_codes: []const u8,
        };
        var bindings_buffer: [3]Binding = undefined;
        var bindings: []Binding = bindings_buffer[0..0];
        var pos: usize = @sizeOf(MachHeader);
        for (0..header.ncmds) |_| {
            try file.seekTo(pos);
            const load_cmd = try readStruct(LoadCommand, file);
            try file.seekBy(-@sizeOf(LoadCommand));
            switch (load_cmd.cmd) {
                if (bits == 64) std.macho.LC.SEGMENT_64 else std.macho.LC.SEGMENT => {
                    // look for data sections
                    const segment_cmd = try readStruct(SegmentCommand, file);
                    const index = data_segments.len;
                    if ((segment_cmd.initprot & std.macho.PROT.WRITE) != 0 and index < 8) {
                        data_segments.len = index + 1;
                        data_segments[index].offset = segment_cmd.vmaddr;
                        data_segments[index].index = index + 1;
                        data_segments[index].read_only = (segment_cmd.flags & std.macho.SG_READ_ONLY) != 0;
                    }
                },
                std.macho.LC.SYMTAB => {
                    // load symbols
                    const symtab_cmd = try readStruct(SymtabCommand, file);
                    try file.seekTo(symtab_cmd.symoff);
                    symbols = try readStructs(NList, allocator, file, symtab_cmd.nsyms);
                    try file.seekTo(symtab_cmd.stroff);
                    symbol_strs = try readStructs(u8, allocator, file, symtab_cmd.strsize);
                },
                std.macho.LC.DYLD_INFO, std.macho.LC.DYLD_INFO_ONLY => {
                    const dyld_info_cmd = try readStruct(DyldInfoCommand, file);
                    bindings.len = 3;
                    bindings[0].offset = dyld_info_cmd.bind_off;
                    bindings[0].size = dyld_info_cmd.bind_size;
                    bindings[1].offset = dyld_info_cmd.weak_bind_off;
                    bindings[1].size = dyld_info_cmd.weak_bind_size;
                    bindings[2].offset = dyld_info_cmd.lazy_bind_off;
                    bindings[2].size = dyld_info_cmd.lazy_bind_size;
                    for (bindings) |*binding_ptr| {
                        try file.seekTo(binding_ptr.offset);
                        binding_ptr.byte_codes = try readStructs(u8, allocator, file, binding_ptr.size);
                    }
                },
                else => {},
            }
            pos += load_cmd.cmdsize;
        }
        defer if (symbols.len > 0) allocator.free(symbols);
        defer if (symbol_strs.len > 0) allocator.free(symbol_strs);
        defer for (bindings) |b| allocator.free(b.byte_codes);
        const base_address: usize = for (symbols) |s| {
            if (s.n_type & std.macho.N_EXT != 0) {
                const symbol_name_ptr: [*:0]const u8 = @ptrCast(&symbol_strs[s.n_strx]);
                const symbol_name_len = std.mem.len(symbol_name_ptr);
                const symbol_name: [:0]const u8 = @ptrCast(symbol_name_ptr[0..symbol_name_len]);
                if (lib.lookup(*anyopaque, symbol_name[1..])) |symbol| {
                    break @intFromPtr(symbol) - s.n_value;
                }
            }
        } else 0;
        if (base_address == 0 or data_segments.len == 0) return error.Unexpected;
        for (bindings) |binding| {
            const bytes = binding.byte_codes;
            var offset: usize = 0;
            var segment_index: usize = 0;
            var symbol_name: ?[*:0]const u8 = null;
            var index: usize = 0;
            while (index < bytes.len) {
                const byte = binding.byte_codes[index];
                index += 1;
                const immediate: u8 = byte & std.macho.BIND_IMMEDIATE_MASK;
                const opcode = byte & std.macho.BIND_OPCODE_MASK;
                switch (opcode) {
                    std.macho.BIND_OPCODE_DONE => {},
                    std.macho.BIND_OPCODE_SET_DYLIB_ORDINAL_IMM => {},
                    std.macho.BIND_OPCODE_SET_DYLIB_ORDINAL_ULEB => {
                        _, const width = try extractUleb128(bytes, index);
                        index += width;
                    },
                    std.macho.BIND_OPCODE_SET_DYLIB_SPECIAL_IMM => {},
                    std.macho.BIND_OPCODE_SET_SYMBOL_TRAILING_FLAGS_IMM => {
                        const str = try extractString(bytes, index);
                        index += str.len + 1;
                        symbol_name = str;
                    },
                    std.macho.BIND_OPCODE_SET_TYPE_IMM => {},
                    std.macho.BIND_OPCODE_SET_ADDEND_SLEB => {
                        _, const width = try extractSleb128(bytes, index);
                        index += width;
                    },
                    std.macho.BIND_OPCODE_SET_SEGMENT_AND_OFFSET_ULEB => {
                        segment_index = immediate;
                        offset, const width = try extractUleb128(bytes, index);
                        index += width;
                    },
                    std.macho.BIND_OPCODE_ADD_ADDR_ULEB => {
                        const skip, const width = try extractUleb128(bytes, index);
                        index += width;
                        offset += skip;
                    },
                    std.macho.BIND_OPCODE_DO_BIND_ULEB_TIMES_SKIPPING_ULEB => {
                        const count, const width1 = try extractUleb128(bytes, index);
                        index += width1;
                        const skip, const width2 = try extractUleb128(bytes, index);
                        index += width2;
                        offset += count * (@sizeOf(usize) + skip);
                    },
                    std.macho.BIND_OPCODE_DO_BIND,
                    std.macho.BIND_OPCODE_DO_BIND_ADD_ADDR_ULEB,
                    std.macho.BIND_OPCODE_DO_BIND_ADD_ADDR_IMM_SCALED,
                    => {
                        const current_offset = offset;
                        const extra: usize = switch (opcode) {
                            std.macho.BIND_OPCODE_DO_BIND => 0,
                            std.macho.BIND_OPCODE_DO_BIND_ADD_ADDR_ULEB => get: {
                                const value, const width = try extractUleb128(bytes, index);
                                index += width;
                                break :get value;
                            },
                            std.macho.BIND_OPCODE_DO_BIND_ADD_ADDR_IMM_SCALED => (immediate + 1) * @sizeOf(usize),
                            else => unreachable,
                        };
                        offset += @sizeOf(usize) + extra;
                        // here's where we do the lookup
                        const name = symbol_name orelse continue;
                        defer symbol_name = null;
                        const hook = find_hook(name[1..]) orelse continue;
                        const ds = for (data_segments) |ds| {
                            if (ds.index == segment_index) break ds;
                        } else continue;
                        const address = base_address + ds.offset + current_offset;
                        const ptr: **const anyopaque = @ptrFromInt(address);
                        if (ptr.* != hook) {
                            if (ds.read_only) {
                                // disable write protection
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
                    },
                    else => break,
                }
            }
        }
        set_override(cb);
    }

    fn extractString(bytes: []const u8, index: usize) ![:0]const u8 {
        return for (bytes[index..], 0..) |byte, i| {
            if (byte == 0) break @ptrCast(bytes[index .. index + i]);
        } else error.Unexpected;
    }

    fn extractUleb128(bytes: []const u8, index: usize) !std.meta.Tuple(&.{ usize, usize }) {
        var value: isize = 0;
        var shift: u6 = 0;
        return for (bytes[index..], 0..) |byte, i| {
            value |= (@as(isize, byte) & 0x7f) << shift;
            shift += 7;
            if ((byte & 0x80) == 0) break .{ @bitCast(value), i + 1 };
        } else error.Unexpected;
    }

    fn extractSleb128(bytes: []const u8, index: usize) !std.meta.Tuple(&.{ isize, usize }) {
        var value: isize = 0;
        var shift: u6 = 0;
        return for (bytes[index..], 0..) |byte, i| {
            value |= (@as(isize, byte) & 0x7f) << shift;
            shift += 7;
            if ((byte & 0x80) == 0) {
                if (shift < 64 and (byte & 0x40) != 0) value |= @as(isize, -1) << shift;
                break .{ value, i + 1 };
            }
        } else error.Unexpected;
    }
};

const windows = struct {
    const c = @cImport({
        @cInclude("windows.h");
        @cInclude("imagehlp.h");
    });

    const ThunkData = c.IMAGE_THUNK_DATA;
    const ImportDescriptor = c.IMAGE_IMPORT_DESCRIPTOR;
    const ImportByName = c.IMAGE_IMPORT_BY_NAME;
    const directoryEntryToDataEx = c.ImageDirectoryEntryToDataEx;
    const snapByOrdinal = c.IMAGE_SNAP_BY_ORDINAL;
    const directory_entry_import = c.IMAGE_DIRECTORY_ENTRY_IMPORT;
    const TRUE = c.TRUE;

    fn redirectIO(lib: *std.DynLib, _: []const u8, cb: Callback) !void {
        const hmodule = lib.inner.dll;
        const bytes: [*]u8 = @ptrCast(hmodule);
        var size: c_ulong = undefined;
        const data = directoryEntryToDataEx(hmodule, TRUE, directory_entry_import, &size, null);
        const import_desc: [*]ImportDescriptor = @ptrCast(@alignCast(data));
        var desc_index: usize = 0;
        while (true) : (desc_index += 1) {
            const entry = import_desc[desc_index];
            if (entry.unnamed_0.Characteristics == 0 or entry.Name == 0) break;
            const addr_table: [*]ThunkData = @ptrCast(@alignCast(&bytes[entry.FirstThunk]));
            const name_table: [*]ThunkData = @ptrCast(@alignCast(&bytes[entry.unnamed_0.OriginalFirstThunk]));
            var iat_index: usize = 0;
            while (true) : (iat_index += 1) {
                const iat_ptr = &addr_table[iat_index];
                const int_ptr = &name_table[iat_index];
                if (iat_ptr.u1.Function == 0) break;
                if (snapByOrdinal(int_ptr.u1.Ordinal)) continue;
                const ibm_ptr: *ImportByName = @ptrCast(@alignCast(&bytes[int_ptr.u1.AddressOfData]));
                const name: [*:0]const u8 = @ptrCast(&ibm_ptr.Name);
                const hook = find_hook(name) orelse continue;
                const ptr: **const anyopaque = @ptrCast(&iat_ptr.u1.Function);
                if (ptr.* != hook) {
                    // make page writable
                    var mbi: std.os.windows.MEMORY_BASIC_INFORMATION = undefined;
                    var protect: u32 = std.os.windows.PAGE_READWRITE;
                    _ = try std.os.windows.VirtualQuery(@ptrCast(ptr), &mbi, @sizeOf(std.os.windows.MEMORY_BASIC_INFORMATION));
                    try std.os.windows.VirtualProtect(mbi.BaseAddress, mbi.RegionSize, protect, &mbi.Protect);
                    defer std.os.windows.VirtualProtect(mbi.BaseAddress, mbi.RegionSize, mbi.Protect, &protect) catch {};
                    // replace with hook
                    ptr.* = hook;
                }
            }
        }
        set_override(cb);
    }
};

const unknown = struct {
    fn redirectIO(_: *std.DynLib, _: []const u8, _: Callback) !void {}
};

fn readStructs(comptime T: type, allocator: std.mem.Allocator, file: std.fs.File, count: usize) ![]T {
    const buffer = try allocator.alloc(T, count);
    errdefer allocator.free(buffer);
    const len = @sizeOf(T) * count;
    const bytes: [*]u8 = @ptrCast(buffer.ptr);
    if (try file.read(bytes[0..len]) != len) return error.Unexpected;
    return buffer;
}

fn readStruct(comptime T: type, file: std.fs.File) !T {
    var buffer: T = undefined;
    const len = @sizeOf(T);
    const bytes: [*]u8 = @ptrCast(&buffer);
    if (try file.read(bytes[0..len]) != len) return error.Unexpected;
    return buffer;
}
