const std = @import("std");
const c_allocator = std.heap.c_allocator;
const builtin = @import("builtin");

const syscall = @import("syscall.zig");

const os = switch (builtin.target.os.tag) {
    .linux => .linux,
    .driverkit, .ios, .macos, .tvos, .visionos, .watchos => .darwin,
    .windows => .windows,
    else => .unknown,
};
const windows_h = @cImport({
    @cInclude("windows.h");
    @cInclude("imagehlp.h");
});
const dlfcn_h = @cImport({
    @cDefine("_GNU_SOURCE", {});
    @cInclude("dlfcn.h");
});
const prctl_h = @cImport({
    @cInclude("sys/prctl.h");
});

pub fn Controller(comptime Host: type) type {
    const bits = @bitSizeOf(usize);
    const LibExtent = struct { address: usize = 0, len: usize = 0 };
    const syscall_user_dispatch = os == .linux and builtin.target.cpu.arch.isX86();

    return struct {
        pub fn installHooks(host: *Host, lib: *std.DynLib, path: []const u8) !LibExtent {
            var sfb = std.heap.stackFallback(4096, c_allocator);
            const allocator = sfb.get();
            if (os == .linux) {
                const elf = std.elf;
                const Elf_Ehdr = if (bits == 64) elf.Elf64_Ehdr else elf.Elf32_Ehdr;
                const Elf_Phdr = if (bits == 64) elf.Elf64_Phdr else elf.Elf32_Phdr;
                const Elf_Shdr = if (bits == 64) elf.Elf64_Shdr else elf.Elf32_Shdr;
                const Elf_Sym = if (bits == 64) elf.Elf64_Sym else elf.Elf32_Sym;
                const Elf_Rel = if (bits == 64) elf.Elf64_Rela else elf.Elf32_Rel;
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
                        const hook = host.getSyscallHook(symbol_name) orelse continue;
                        // get protection flags from segment load commands
                        var read_only = false;
                        for (segments) |seg| {
                            if (seg.p_vaddr <= r.r_offset and r.r_offset < seg.p_vaddr + seg.p_memsz) {
                                read_only = (seg.p_flags & elf.PF_W) == 0;
                            }
                        }
                        const address = base_address + r.r_offset;
                        try installHook(hook, address, read_only);
                    }
                }
                // determine the library's extent
                var max_vaddr: ?usize = null;
                for (segments) |segment| {
                    const end = segment.p_vaddr + segment.p_memsz;
                    if (max_vaddr == null or end > max_vaddr.?) max_vaddr = end;
                }
                return .{ .address = base_address, .len = max_vaddr.? };
            } else if (os == .darwin) {
                const macho = std.macho;
                const MachHeader = if (bits == 64) macho.mach_header_64 else macho.mach_header;
                const LoadCommand = macho.load_command;
                const SymtabCommand = macho.symtab_command;
                const DyldInfoCommand = macho.dyld_info_command;
                const SegmentCommand = if (bits == 64) macho.segment_command_64 else macho.segment_command;
                const NList = if (bits == 64) macho.nlist_64 else macho.nlist;

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
                                const hook = host.getSyscallHook(name[1..]) orelse continue;
                                const ds = for (data_segments) |ds| {
                                    if (ds.index == segment_index) break ds;
                                } else continue;
                                const address = base_address + ds.offset + current_offset;
                                try installHook(hook, address, ds.read_only);
                            },
                            else => break,
                        }
                    }
                }
                return .{};
            } else if (os == .windows) {
                const ThunkData = windows_h.IMAGE_THUNK_DATA;
                const ImportDescriptor = windows_h.IMAGE_IMPORT_DESCRIPTOR;
                const ImportByName = windows_h.IMAGE_IMPORT_BY_NAME;
                const directoryEntryToDataEx = windows_h.ImageDirectoryEntryToDataEx;
                const snapByOrdinal = windows_h.IMAGE_SNAP_BY_ORDINAL;
                const directory_entry_import = windows_h.IMAGE_DIRECTORY_ENTRY_IMPORT;
                const TRUE = windows_h.TRUE;

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
                        const hook = host.getSyscallHook(name) orelse continue;
                        const address = @intFromPtr(&iat_ptr.u1.Function);
                        try installHook(hook, address, true);
                    }
                }
                return .{};
            }
        }

        pub fn installHooksInLibraryOf(host: *Host, ptr: *const anyopaque) !LibExtent {
            var lib: std.DynLib, const path: []const u8 = switch (os) {
                .linux, .darwin => get: {
                    var info: dlfcn_h.Dl_info = undefined;
                    if (dlfcn_h.dladdr(ptr, &info) == 0) return error.UnableToGetLibraryInfo;
                    const path = std.mem.sliceTo(info.dli_fname, 0);
                    break :get .{ try std.DynLib.openZ(info.dli_fname), path };
                },
                .windows => get: {
                    var handle: windows_h.HMODULE = undefined;
                    if (windows_h.GetModuleHandleExA(windows_h.GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, @ptrCast(ptr), &handle) == 0)
                        return error.UnableToGetLibraryInfo;
                    break :get .{ .{ .inner = .{ .dll = @ptrCast(handle) } }, "" }; // path isn't needed on Windows
                },
                else => unreachable,
            };
            defer lib.close();
            return try installHooks(host, &lib, path);
        }

        pub fn installHook(hook: Host.HookEntry, address: usize, read_only: bool) !void {
            if (hook.deferred) |deferred_ptr| {
                deferred_ptr.* = .{
                    .address = address,
                    .read_only = read_only,
                };
            } else {
                if (try replacePointer(hook.handler, address, read_only)) |original| {
                    hook.original.* = original;
                }
            }
        }

        pub fn uninstallHook(hook: Host.HookEntry, address: usize, read_only: bool) !void {
            _ = try replacePointer(hook.original.*, address, read_only);
        }

        fn replacePointer(target: *const anyopaque, address: usize, read_only: bool) !?*const anyopaque {
            const ptr: **const anyopaque = @ptrFromInt(address);
            const original = ptr.*;
            if (ptr.* == target) return null;
            if (read_only) {
                const page = getPageSlice(address);
                // std.posix.mprotect() does support Windows
                try std.posix.mprotect(page, std.c.PROT.READ | std.c.PROT.WRITE);
                defer std.posix.mprotect(page, std.c.PROT.READ) catch {};
                ptr.* = target;
            } else {
                ptr.* = target;
            }
            return original;
        }

        const HandlerEntry = struct {
            start_address: usize,
            end_address: usize,
            vtable: *const Host.HandlerVTable,
        };

        const empty_list: [*]const HandlerEntry = &.{
            .{ .start_address = 0, .end_address = 0, .vtable = undefined },
        };
        var syscall_vtables: [*]const HandlerEntry = empty_list;
        var syscall_vtables_mutex: std.Thread.Mutex = .{};

        pub fn addSyscallVtable(pos: LibExtent, vtable: *const Host.HandlerVTable) !void {
            if (syscall_user_dispatch) {
                // the list is a many pointer that we can update atomically
                // in order to expand it we need to determine the new length first
                syscall_vtables_mutex.lock();
                defer syscall_vtables_mutex.unlock();
                const list = syscall_vtables;
                const old_len = count: {
                    var index: usize = 0;
                    while (true) : (index += 1) {
                        const entry = list[index];
                        if (entry.start_address == 0) break;
                    }
                    break :count index;
                };
                const new_len = old_len + 1;
                const new_list = try c_allocator.alloc(HandlerEntry, new_len + 1);
                // copy from old list
                for (0..old_len) |index| {
                    new_list[index] = list[index];
                }
                new_list[old_len] = .{
                    .start_address = pos.address,
                    .end_address = pos.address + pos.len,
                    .vtable = vtable,
                };
                // add terminator
                new_list[new_len] = empty_list[0];
                // make the switch
                syscall_vtables = new_list.ptr;
                // free the old list if necessary
                if (list != empty_list) c_allocator.free(list[0 .. old_len + 1]);
            }
        }

        pub fn removeSyscallVtable(vtable: *const Host.HandlerVTable) !void {
            if (syscall_user_dispatch) {
                syscall_vtables_mutex.lock();
                defer syscall_vtables_mutex.unlock();
                const list = syscall_vtables;
                const old_len = count: {
                    var index: usize = 0;
                    while (true) : (index += 1) {
                        const entry = list[index];
                        if (entry.start_address == 0) break;
                    }
                    break :count index;
                };
                const new_len: usize = count: {
                    var len: usize = old_len;
                    var index: usize = 0;
                    while (true) : (index += 1) {
                        const entry = list[index];
                        if (entry.vtable == vtable) len -= 1;
                        if (entry.start_address == 0) break;
                    }
                    break :count len;
                };
                if (new_len > 0) {
                    const new_list = try c_allocator.alloc(HandlerEntry, new_len + 1);
                    var remaining: usize = 0;
                    for (list[0..old_len]) |entry| {
                        if (entry.vtable != vtable) {
                            new_list[remaining] = entry;
                            remaining += 1;
                        }
                    }
                    new_list[new_len] = empty_list[0];
                    syscall_vtables = new_list.ptr;
                } else {
                    syscall_vtables = empty_list;
                }
                c_allocator.free(list[0 .. old_len + 1]);
            }
        }

        fn getSyscallVtable(address: usize) ?*const Host.HandlerVTable {
            const list = syscall_vtables;
            var index: usize = 0;
            while (true) : (index += 1) {
                const entry = list[index];
                if (entry.start_address == 0) break;
                if (entry.start_address <= address and address < entry.end_address) {
                    return entry.vtable;
                }
            }
            return null;
        }

        pub fn installSyscallTrap(ptr: *const bool) !void {
            if (syscall_user_dispatch) {
                // enable syscall user dispatch, excluding the memory region where libc sits; the signal
                // trampoline is also inside this range, allowing us to reenable trapping from within
                // the signal handler (otherwise sigreturn() would trigger SIGSYS inside a SIGSYS)
                const libc = try getLibcExtent();
                if (std.c.prctl(
                    prctl_h.PR_SET_SYSCALL_USER_DISPATCH,
                    prctl_h.PR_SYS_DISPATCH_ON,
                    libc.address,
                    libc.len,
                    @intFromPtr(ptr),
                ) != 0) {
                    return error.SyscallUserDispatchFailure;
                }
            }
        }

        pub fn uninstallSyscallTrap() void {
            if (syscall_user_dispatch) {
                _ = std.c.prctl(
                    prctl_h.PR_SET_SYSCALL_USER_DISPATCH,
                    prctl_h.PR_SYS_DISPATCH_OFF,
                    @as(usize, 0),
                    @as(usize, 0),
                    @as(usize, 0),
                );
            }
        }

        var sig_handler_count = std.atomic.Value(usize).init(0);
        var previous_signal_handler: ?std.c.Sigaction = null;

        pub fn installSignalHandler() !void {
            if (syscall_user_dispatch) {
                // don't do anything if the trap is already set
                if (sig_handler_count.fetchAdd(1, .monotonic) > 0) return;
                const act: std.c.Sigaction = .{
                    .handler = .{ .sigaction = handleSigsysSignal },
                    .mask = std.mem.zeroes(std.c.sigset_t),
                    .flags = std.c.SA.SIGINFO,
                };
                var prev_act: std.c.Sigaction = undefined;
                if (std.c.sigaction(std.c.SIG.SYS, &act, &prev_act) != 0) return error.SignalHandlingFailure;
                errdefer _ = std.c.sigaction(std.c.SIG.SYS, &prev_act, null);
                if (prev_act.flags != 0) {
                    return error.UnexpectedSignalHandlingStatus;
                }
                previous_signal_handler = prev_act;
            }
        }

        pub fn uninstallSignalHandler() void {
            if (syscall_user_dispatch) {
                if (sig_handler_count.fetchSub(1, .monotonic) > 1) return;
                if (previous_signal_handler) |prev_act| {
                    _ = std.c.sigaction(std.c.SIG.SYS, &prev_act, null);
                }
            }
        }

        var libc_extent: ?LibExtent = null;

        fn getLibcExtent() !LibExtent {
            if (os != .linux) @compileError("Unsupported");
            return libc_extent orelse {
                const elf = std.elf;
                const Elf_Ehdr = if (bits == 64) elf.Elf64_Ehdr else elf.Elf32_Ehdr;
                const Elf_Phdr = if (bits == 64) elf.Elf64_Phdr else elf.Elf32_Phdr;

                // look for libc's path and base address
                var dl_info: dlfcn_h.Dl_info = undefined;
                const dladdr_res = dlfcn_h.dladdr(&std.c.sigaction, &dl_info);
                if (dladdr_res == 0) {
                    return error.Unexpected;
                }
                const libc_path = dl_info.dli_fname[0..std.mem.len(dl_info.dli_fname)];
                const libc_address = @intFromPtr(dl_info.dli_fbase.?);
                // scan the .so to determine its extent in memory
                var sfb = std.heap.stackFallback(4096, c_allocator);
                const allocator = sfb.get();
                const file = try std.fs.openFileAbsolute(libc_path, .{});
                defer file.close();
                const header = try readStruct(Elf_Ehdr, file);
                try file.seekTo(header.e_phoff);
                const segments = try readStructs(Elf_Phdr, allocator, file, header.e_phnum);
                defer allocator.free(segments);
                var max_vaddr: ?usize = null;
                for (segments) |segment| {
                    const end = segment.p_vaddr + segment.p_memsz;
                    if (max_vaddr == null or end > max_vaddr.?) max_vaddr = end;
                }
                libc_extent = .{ .address = libc_address, .len = max_vaddr.? };
                return libc_extent.?;
            };
        }

        fn handleSigsysSignal(_: std.posix.SIG, info: *const std.c.siginfo_t, ucontext: ?*anyopaque) callconv(.c) void {
            if (os != .linux) @compileError("Unsupported");
            if (@TypeOf(syscall.table) == void) return;
            @setEvalBranchQuota(2000000);
            Host.trapping_syscalls = false;
            defer Host.trapping_syscalls = true;
            inline for (syscall.table) |sc| {
                if (info.fields.sigsys.syscall == sc.num) {
                    const args = syscall.getArguments(ucontext, sc.args);
                    if (@hasField(Host.HandlerVTable, sc.name)) {
                        const ip = syscall.getInstructionPointer(ucontext);
                        if (getSyscallVtable(ip)) |vtable| {
                            const handler = @field(vtable, sc.name);
                            const FnPtrT = @TypeOf(handler);
                            const FnT = @typeInfo(FnPtrT).pointer.child;
                            var handler_args: std.meta.ArgsTuple(FnT) = undefined;
                            const RvPtrT = @TypeOf(handler_args[handler_args.len - 1]);
                            const RvT = @typeInfo(RvPtrT).pointer.child;
                            var result: RvT = undefined;
                            inline for (&handler_args, 0..) |*ptr, arg_index| {
                                const ArgT = @TypeOf(ptr.*);
                                ptr.* = if (arg_index == handler_args.len - 1) &result else switch (@typeInfo(ArgT)) {
                                    .pointer => @ptrFromInt(args[arg_index]),
                                    .int => |int| cast: {
                                        const arg_trunc: @Int(.unsigned, int.bits) = @truncate(args[arg_index]);
                                        break :cast @bitCast(arg_trunc);
                                    },
                                    else => @compileError("Unrecognized type"),
                                };
                            }
                            if (@call(.auto, handler, handler_args)) {
                                // call was handled--set the return value
                                const rv_unsigned: switch (@typeInfo(RvT)) {
                                    .int => |int| @Int(.unsigned, int.bits),
                                    else => usize,
                                } = switch (@typeInfo(RvT)) {
                                    .pointer => @intFromPtr(result),
                                    .optional => if (result) |p| @intFromPtr(p) else 0,
                                    else => @bitCast(result),
                                };
                                syscall.setRetval(ucontext, rv_unsigned);
                                return;
                            }
                        }
                    }
                    // perform the syscall normally
                    const fn_name = std.fmt.comptimePrint("syscall{d}", .{sc.args});
                    const syscaller = @field(std.os.linux, fn_name);
                    var syscall_args: std.meta.ArgsTuple(@TypeOf(syscaller)) = undefined;
                    inline for (&syscall_args, 0..) |*ptr, arg_index| {
                        ptr.* = switch (arg_index) {
                            0 => @enumFromInt(info.fields.sigsys.syscall),
                            else => args[arg_index - 1],
                        };
                    }
                    const retval = @call(.auto, syscaller, syscall_args);
                    syscall.setRetval(ucontext, retval);
                }
            }
        }

        fn getPageSlice(address: usize) []align(std.heap.page_size_min) u8 {
            const page_size = std.heap.pageSize();
            const page_address = std.mem.alignBackward(usize, address, page_size);
            const page_ptr: [*]align(std.heap.page_size_min) u8 = @ptrFromInt(page_address);
            return page_ptr[0..page_size];
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
    };
}
