#include <stdio.h>
#include <stdarg.h>
#include <string.h>
#include <errno.h>
#if defined(_WIN32)
    #include <windows.h>
    #include <io.h>
#else
    #include <unistd.h>
#endif
#include "./redirect.h"

override_callback override = NULL;

#if defined(_WIN32)
BOOL WINAPI write_file_hook(HANDLE handle,
                            LPCVOID buffer,
                            DWORD len,
                            LPDWORD written,
                            LPOVERLAPPED overlapped) {
    static HANDLE handle1 = NULL, handle2 = NULL;
    if (!handle1) {
        handle1 = GetStdHandle(STD_OUTPUT_HANDLE);
    }
    if (!handle2) {
        handle2 = GetStdHandle(STD_ERROR_HANDLE);
    }
    if (handle == handle1 || handle == handle2) {
        // return value of zero means success
        if (override(buffer, len) == 0) {
            *written = len;
            if (overlapped) {
                SetEvent(overlapped->hEvent);
            }
            return TRUE;
        }
    }
    return WriteFile(handle, buffer, len, written, overlapped);
}
#endif

ssize_t write_hook(int fd,
                   const void* buffer,
                   size_t len) {
    // 1 = stdout, 2 = stderr
    if (fd == 1 || fd == 2) {
        // return value of zero means success
        if (override(buffer, len) == 0) {
            return len;
        }
    }
    return write(fd, buffer, len);
}

size_t fwrite_hook(const void *ptr,
                   size_t size,
		           size_t n,
                   FILE* s) {
    if (s == stdout || s == stderr) {
        if (override(ptr, size * n) == 0) {
            return n;
        }
    }
    return fwrite(ptr, size, n, s);
}

int fputs_hook(const char *t,
               FILE* s) {
    if (s == stdout || s == stderr) {
        size_t len = strlen(t);
        if (override(t, len) == 0) {
            return len;
        }
    }
    return fputs(t, s);
}

int puts_hook(const char *t) {
    size_t len = strlen(t);
    if (override(t, len) == 0) {
        override("\n", 1);
        return 1;
    }
    return puts(t);
}

int fputc_hook(int c,
               FILE* s) {
    if (s == stdout || s == stderr) {
        unsigned char b = c;
        if (override(&b, 1) == 0) {
            return 1;
        }
    }
    return fputc(c, s);
}

int putchar_hook(int c) {
    return fputc_hook(c, stdout);
}

int vfprintf_hook_impl(FILE* s,
                       const char* f,
                       va_list arg) {
    if (s == stdout || s == stderr) {
        // attempt with fixed-size buffer, using a copy of arg
        va_list arg_copy;
        va_copy(arg_copy, arg);
        char fixed_buffer[1024];
        char* s = fixed_buffer;
        int len = vsnprintf(fixed_buffer, sizeof(fixed_buffer), f, arg_copy);
        bool too_large = len + 1 > sizeof(fixed_buffer);
        if (too_large) {
            va_copy(arg_copy, arg);
            s = malloc(len + 1);
            vsnprintf(s, len + 1, f, arg_copy);
        }
        bool overrode = override(s, len) == 0;
        if (too_large) {
            free(s);
        }
        if (overrode) {
            return len;
        }
    }
    return -1;
}

int vfprintf_hook(FILE* s,
                  const char* f,
                  va_list arg) {
    int len = vfprintf_hook_impl(s, f, arg);
    return (len >= 0) ? len : vfprintf(s, f, arg);
}

int vprintf_hook(const char* f,
                 va_list arg) {
    return vfprintf_hook(stdout, f, arg);
}

int fprintf_hook(FILE* s,
                 const char* f,
                 ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

int printf_hook(const char* f,
                ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}

void perror_hook(const char *s) {
    printf_hook("%s: %s", s, strerror(errno));
}

#if defined(_WIN32)
int stdio_common_vfprintf_hook(unsigned __int64 options,
                               FILE* s,
                               char const* f,
                               _locale_t locale,
                               va_list arg) {
    int len = vfprintf_hook_impl(s, f, arg);
    return (len >= 0) ? len : __stdio_common_vfprintf(options, s, f, locale, arg);
}
#elif defined(__GLIBC__)
int vfprintf_chk_hook(FILE* s,
                      int flag,
                      const char* f,
                      va_list arg) {
    return vfprintf_hook(s, f, arg);
}

int vprintf_chk_hook(int flag,
                     const char* f,
                     va_list arg) {
    return vfprintf_chk_hook(stdout, flag, f, arg);
}

int fprintf_chk_hook(FILE* s,
                     int flag,
                     const char* f,
                     ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(s, flag, f, argptr);
    va_end(argptr);
    return n;
}

int printf_chk_hook(int flag,
                    const char* f,
                    ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(stdout, flag, f, argptr);
    va_end(argptr);
    return n;
}
#endif

typedef struct {
    const char* name;
    void* function;
} hook;

hook hooks[] = {
#if defined(_WIN32)
    { "WriteFile",                  write_file_hook },
    { "_write",                     write_hook },
#else
    { "write",                      write_hook },
#endif
    { "fputs",                      fputs_hook },
    { "puts",                       puts_hook },
    { "fputc",                      fputc_hook },
    { "putc",                       fputc_hook },
    { "putchar",                    putchar_hook },
    { "fwrite",                     fwrite_hook },
    { "vfprintf",                   vfprintf_hook },
    { "vprintf",                    vprintf_hook },
    { "fprintf",                    fprintf_hook },
    { "printf",                     printf_hook },
    { "perror",                     perror_hook },
#if defined(_WIN32)
    { "__stdio_common_vfprintf",    stdio_common_vfprintf_hook },
#elif defined(__GLIBC__)
    { "__vfprintf_chk",             vfprintf_chk_hook },
    { "__vprintf_chk",              vprintf_chk_hook },
    { "__fprintf_chk",              fprintf_chk_hook },
    { "__printf_chk",               printf_chk_hook },
#endif
};
#define HOOK_COUNT (sizeof(hooks) / sizeof(hook))

void* find_hook(const char* name) {
    for (int i = 0; i < HOOK_COUNT; i++) {
        if (strcmp(name, hooks[i].name) == 0) {
            return hooks[i].function;
        }
    }
    return NULL;
}

#if defined(_WIN32)
#include <imagehlp.h>

void redirect_io_functions(void* handle,
                           const char* filename,
                           override_callback cb) {
    override = cb;
    PBYTE bytes = (PBYTE) handle;
    // find IAT
    ULONG size;
    PVOID data = ImageDirectoryEntryToDataEx(handle, TRUE, IMAGE_DIRECTORY_ENTRY_IMPORT, &size, NULL);
    PIMAGE_IMPORT_DESCRIPTOR import_desc = (PIMAGE_IMPORT_DESCRIPTOR) data;
    for (PIMAGE_IMPORT_DESCRIPTOR entry = import_desc; entry->Characteristics && entry->Name; entry++) {
        // look for kernel32.dll
        PSTR import_name = (PSTR) (bytes + entry->Name);
        PIMAGE_THUNK_DATA addr_table = (PIMAGE_THUNK_DATA) (bytes + entry->FirstThunk);
        PIMAGE_THUNK_DATA name_table = (PIMAGE_THUNK_DATA) (bytes + entry->OriginalFirstThunk);
        for (PIMAGE_THUNK_DATA iat_ptr = addr_table, int_ptr = name_table; iat_ptr->u1.Function; iat_ptr++, int_ptr++) {
            if (!IMAGE_SNAP_BY_ORDINAL(int_ptr->u1.Ordinal)) {
                PIMAGE_IMPORT_BY_NAME ibm_ptr = (PIMAGE_IMPORT_BY_NAME) (bytes + int_ptr->u1.AddressOfData);
                void* hook = find_hook(ibm_ptr->Name);
                if (hook) {
                    PROC* fn_pointer = (PROC*) &iat_ptr->u1.Function;
                    if (*fn_pointer != hook) {
                        // make page writable
                        MEMORY_BASIC_INFORMATION mbi;
                        DWORD protect = PAGE_READWRITE;
                        VirtualQuery(fn_pointer, &mbi, sizeof(MEMORY_BASIC_INFORMATION));
                        if (VirtualProtect(mbi.BaseAddress, mbi.RegionSize, protect, &mbi.Protect)) {
                            // replace with hook
                            *fn_pointer = hook;
                            // restore original flags
                            VirtualProtect(mbi.BaseAddress, mbi.RegionSize, mbi.Protect, &protect);
                        }
                    }
                }
            }
        }
    }
}
#elif defined(__ELF__)
#include <fcntl.h>
#include <dlfcn.h>
#include <sys/mman.h>
#include <elf.h>

#if defined __x86_64 || defined __aarch64__
    #define Elf_Ehdr Elf64_Ehdr
    #define Elf_Shdr Elf64_Shdr
    #define Elf_Sym Elf64_Sym
    #define Elf_Rel Elf64_Rela
    #define ELF_R_SYM ELF64_R_SYM
    #define ELF_ST_BIND ELF64_ST_BIND
#else
    #define Elf_Ehdr Elf32_Ehdr
    #define Elf_Shdr Elf32_Shdr
    #define Elf_Sym Elf32_Sym
    #define Elf_Rel Elf32_Rel
    #define ELF_R_SYM ELF32_R_SYM
    #define ELF_ST_BIND ELF32_ST_BIND
#endif

int read_string_table(int fd,
                      Elf_Shdr* strtab,
                      char** ps) {
    char* buffer = malloc(strtab->sh_size);
    if (!buffer
     || lseek(fd, strtab->sh_offset, SEEK_SET) < 0
     || read(fd, buffer, strtab->sh_size) <= 0) {
        *ps = NULL;
        return 0;
    }
    *ps = buffer;
    return 1;
}

int get_page_size() {
    static int page_size = 0;
    if (page_size == 0) {
        page_size = sysconf(_SC_PAGE_SIZE);
    }
    return page_size;
}

void redirect_io_functions(void* handle,
                           const char* filename,
                           override_callback cb) {
    override = cb;
    int fd = open(filename, O_RDONLY);
    if (fd <= 0) {
        return;
    }
    Elf_Shdr* sections = NULL;
    char* section_strs = NULL;
    // read ELF header
    Elf_Ehdr header;
    if (read(fd, &header, sizeof(header)) <= 0) {
        goto exit;
    }
    // read all sections
    sections = malloc(header.e_shnum * sizeof(Elf_Shdr));
    if (!sections
     || lseek(fd, header.e_shoff, SEEK_SET) < 0
     || read(fd, sections, header.e_shnum * sizeof(Elf_Shdr)) <= 0
     || read_string_table(fd, &sections[header.e_shstrndx], &section_strs) == 0) {
        goto exit;
    }
    Elf_Sym* symbols = NULL;
    size_t symbol_count = 0;
    char* symbol_strs = NULL;
    // find symbol table
    for (int i = 0; i < header.e_shnum; i++) {
        if (sections[i].sh_type == SHT_DYNSYM) {
            // load symbols
            Elf_Shdr* dynsym = &sections[i];
            symbols = malloc(dynsym->sh_size);
            symbol_count = dynsym->sh_size / sizeof(Elf_Sym);
            if (!symbols
                || lseek(fd, dynsym->sh_offset, SEEK_SET) < 0
                || read(fd, symbols, dynsym->sh_size) <= 0
                || read_string_table(fd, &sections[dynsym->sh_link], &symbol_strs) == 0) {
                goto exit;
            }
            break;
        }
    }
    if (!symbols) {
        goto exit;
    }
    // find base address of library
    uintptr_t base_address = 0;
    for (int i = 0; i < symbol_count; i++) {
        const int binding = ELF_ST_BIND(symbols[i].st_info);
        if ((binding == STB_GLOBAL || binding == STB_WEAK) && symbols[i].st_value != 0) {
            const char* symbol_name = symbol_strs + symbols[i].st_name;
            void *symbol = dlsym(handle, symbol_name);
            if(symbol != NULL) {
                base_address = ((uintptr_t) symbol) - symbols[i].st_value;
                break;
            }
        }
    }
    // scan through relocations
    for (int i = 0; i < header.e_shnum; i++) {
        if (sections[i].sh_type == SHT_RELA) {
            Elf_Shdr* rela = &sections[i];
            const char* section_name = section_strs + rela->sh_name;
            Elf_Rel* rela_entries = (Elf_Rel*) (base_address + rela->sh_addr);
            size_t rela_entry_count = rela->sh_size / sizeof(Elf_Rel);
            for (int j = 0; j < rela_entry_count; j++) {
                size_t symbol_index = ELF_R_SYM(rela_entries[j].r_info);
                if (symbol_index) {
                    const char* symbol_name = symbol_strs + symbols[symbol_index].st_name;
                    void* hook = find_hook(symbol_name);
                    if (hook) {
                        // get address to GOT entry
                        uintptr_t address = base_address + rela_entries[j].r_offset;
                        void** ptr = (void **) address;
                        if (*ptr != hook) {
                            bool read_only = strcmp(section_name, ".rela.plt") == 0;
                            if (read_only) {
                                // disable write protection
                                int page_size = get_page_size();
                                if (page_size == -1) {
                                    goto exit;
                                }
                                uintptr_t page_address = address & ~(page_size - 1);
                                if (mprotect((void*) page_address, page_size, PROT_READ | PROT_WRITE) < 0) {
                                    goto exit;
                                }
                                *ptr = hook;
                                // reenable write protection
                                mprotect((void*) page_address, page_size, PROT_READ);
                            } else {
                                *ptr = hook;
                            }
                        }
                    }
                }
            }

        }
    }

exit:
    free(sections);
    free(section_strs);
    free(symbols);
    free(symbol_strs);
    close(fd);
}
#elif defined(__MACH__)
#define __STRICT_BSD__
#include <fcntl.h>
#include <dlfcn.h>
#include <sys/mman.h>
#include <mach-o/loader.h>
#include <mach-o/reloc.h>
#include <mach-o/nlist.h>
#include <mach-o/stab.h>
#include <mach-o/x86_64/reloc.h>

#if defined(__x86_64) || defined(__aarch64__)
    #define ADD_BITS(t)     t##_64
#else
    #define ADD_BITS(t)     t
#endif

typedef struct ADD_BITS(mach_header)        mach_header;
typedef struct load_command                 load_command;
typedef struct symtab_command			    symtab_command;
typedef struct dyld_info_command            dyld_info_command;
typedef struct ADD_BITS(segment_command)    segment_command;
typedef struct ADD_BITS(nlist)              nlist;
typedef struct ADD_BITS(dylib_module)       dylib_module;

int read_command(int fd,
                 load_command* lc,
                 void *dest,
                 size_t size) {
    if (read(fd, ((load_command*) dest) + 1, size - sizeof(load_command)) < 0) {
        return 0;
    }
    memcpy(dest, lc, sizeof(load_command));
    return 1;
}

const char* extract_string(const uint8_t* bytes, size_t* pos, size_t* end) {
    const char* s = (const char*) &bytes[*pos + 1];
    for (size_t i = *pos + 1; i < *end; i++) {
        if (bytes[i] == 0) {
            *pos = i;
            break;
        }
    }
    return s;
}

uintptr_t extract_uleb128(const uint8_t* bytes, size_t* pos, size_t* end) {
    intptr_t value = 0;
    int shift = 0;
    for (size_t i = *pos + 1; i < *end; i++) {
        uintptr_t byte = bytes[i];
        value |= (byte & 0x7f) << shift;
        shift += 7;
        if ((byte & 0x80) == 0) {
            *pos = i;
            break;
        }
    }
    return value;
}

intptr_t extract_sleb128(const uint8_t* bytes, size_t* pos, size_t* end) {
    intptr_t value = 0;
    int shift = 0;
    for (size_t i = *pos + 1; i < *end; i++) {
        uintptr_t byte = bytes[i];
        value |= (byte & 0x7f) << shift;
        shift += 7;
        if ((byte & 0x80) == 0) {
            *pos = i;
            if (shift < 64 && (byte & 0x40) != 0) {
                value |= (-1LL) << shift;
            }
            break;
        }
    }
    return value;
}

int get_page_size() {
    static int page_size = 0;
    if (page_size == 0) {
        page_size = sysconf(_SC_PAGE_SIZE);
    }
    return page_size;
}

void redirect_io_functions(void* handle,
                           const char* filename,
                           override_callback cb) {
    override = cb;
    int fd = open(filename, O_RDONLY);
    if (fd <= 0) {
        return;
    }
    size_t segment_count = 0;
    struct {
        size_t index;
        uintptr_t offset;
        bool read_only;
    } data_segments[8];
    size_t data_segment_count = 0;
    nlist* symbols = NULL;
    size_t symbol_count = 0;
    char* symbol_strs = NULL;
    struct {
        size_t offset;
        size_t size;
        uint8_t* byte_codes;
    } bindings[3] = { { 0, 0, NULL }, { 0, 0, NULL }, { 0, 0, NULL } };
    // read mach-o header
	mach_header header;
	if(read(fd, &header, sizeof(header)) < 0) {
		goto exit;
	}
    load_command load_cmd;
	off_t pos = sizeof(mach_header);
    // process mach-o commands
	for (int i = 0; i < header.ncmds; i++) {
		if(lseek(fd, pos, SEEK_SET) < 0 || read(fd, &load_cmd, sizeof(load_cmd)) <= 0) {
			goto exit;
		}
        switch (load_cmd.cmd) {
            case ADD_BITS(LC_SEGMENT): {
                // look for data sections
                segment_command seg_cmd;
                if (read_command(fd, &load_cmd, &seg_cmd, sizeof(seg_cmd)) == 0) {
                    goto exit;
                }
                if ((seg_cmd.initprot & VM_PROT_WRITE) && data_segment_count < 8) {
                    size_t index = data_segment_count++;
                    data_segments[index].offset = seg_cmd.vmaddr;
                    data_segments[index].index = segment_count;
                    data_segments[index].read_only = seg_cmd.flags & SG_READ_ONLY;
                }
                segment_count++;
            } break;
            case LC_SYMTAB: {
                // load symbols
                symtab_command sym_cmd;
                if (read_command(fd, &load_cmd, &sym_cmd, sizeof(sym_cmd)) == 0) {
                    goto exit;
                }
                symbols = malloc(sym_cmd.nsyms * sizeof(nlist));
                symbol_count = sym_cmd.nsyms;
                symbol_strs = malloc(sym_cmd.strsize);
                if (!symbols || !symbol_strs
                 || lseek(fd, sym_cmd.symoff, SEEK_SET) < 0
                 || read(fd, symbols, sym_cmd.nsyms * sizeof(nlist)) <= 0
                 || lseek(fd, sym_cmd.stroff, SEEK_SET) < 0
                 || read(fd, symbol_strs, sym_cmd.strsize) <= 0) {
                    goto exit;
                }
            } break;
            case LC_DYLD_INFO:
            case LC_DYLD_INFO_ONLY: {
                dyld_info_command info_cmd;
                if (read_command(fd, &load_cmd, &info_cmd, sizeof(info_cmd)) == 0) {
                    goto exit;
                }
                bindings[0].offset = info_cmd.bind_off;
                bindings[0].size = info_cmd.bind_size;
                bindings[1].offset = info_cmd.weak_bind_off;
                bindings[1].size = info_cmd.weak_bind_size;
                bindings[2].offset = info_cmd.lazy_bind_off;
                bindings[2].size = info_cmd.lazy_bind_size;
                for (int i = 0; i < 3; i++) {
                    if (bindings[i].size > 0)  {
                        bindings[i].byte_codes = malloc(bindings[i].size);
                        if (!bindings[i].byte_codes
                        || lseek(fd, bindings[i].offset, SEEK_SET) < 0
                        || read(fd, bindings[i].byte_codes, bindings[i].size) <= 0) {
                            goto exit;
                        }
                    }
                }
            } break;

        }
		pos += load_cmd.cmdsize;
    }
    uintptr_t base_address = 0;
    for (int i = 0; i < symbol_count; i++) {
        nlist* symbol = &symbols[i];
        if (symbol->n_type & N_EXT) {
            const char* symbol_name = symbol_strs + symbol->n_un.n_strx;
            uintptr_t symbol_address = (uintptr_t) dlsym(handle, symbol_name + 1);
            if (symbol_address != 0) {
                base_address = symbol_address - symbol->n_value;
                break;
            }
        }
    }
    if (base_address == 0 || data_segment_count == 0) {
        goto exit;
    }
    // process strong/weak/lazy bindings
    for (int i = 0; i < 3; i++) {
        uint8_t type = 0;
        uint8_t flags;
        uintptr_t offset = 0;
        const char* symbol_name = NULL;
        size_t segment_index = 0;
        uint8_t* bytes = bindings[i].byte_codes;
        size_t end = bindings[i].size;
        for (size_t j = 0; j < end; j++) {
            uint8_t byte = bytes[j];
            uint8_t immediate = byte & BIND_IMMEDIATE_MASK;
            uint8_t opcode = byte & BIND_OPCODE_MASK;
            switch (opcode) {
                case BIND_OPCODE_DONE: {
                } break;
                case BIND_OPCODE_SET_DYLIB_ORDINAL_IMM: {
                    uint64_t library_ordinal = immediate;
                } break;
                case BIND_OPCODE_SET_DYLIB_ORDINAL_ULEB: {
                    uint64_t library_ordinal = extract_uleb128(bytes, &j, &end);
                } break;
                case BIND_OPCODE_SET_DYLIB_SPECIAL_IMM: {
                    int8_t sign_extended = (immediate) ? BIND_OPCODE_MASK | immediate : 0;
                    uint64_t library_ordinal = sign_extended;
                } break;
                case BIND_OPCODE_SET_SYMBOL_TRAILING_FLAGS_IMM: {
                    flags = immediate;
                    symbol_name = extract_string(bytes, &j, &end);
                } break;
                case BIND_OPCODE_SET_TYPE_IMM: {
                    type = immediate;
                } break;
                case BIND_OPCODE_SET_ADDEND_SLEB: {
                    intptr_t addend = extract_sleb128(bytes, &j, &end);
                } break;
                case BIND_OPCODE_SET_SEGMENT_AND_OFFSET_ULEB: {
                    segment_index = immediate;
                    offset = extract_uleb128(bytes, &j, &end);
                } break;
                case BIND_OPCODE_ADD_ADDR_ULEB: {
                    intptr_t skip = (intptr_t) extract_uleb128(bytes, &j, &end);
                    offset += skip;
                } break;
                case BIND_OPCODE_DO_BIND:
                case BIND_OPCODE_DO_BIND_ADD_ADDR_ULEB:
                case BIND_OPCODE_DO_BIND_ADD_ADDR_IMM_SCALED: {
                    // here's where we do the lookup
                    if (symbol_name) {
                        void* hook = find_hook(symbol_name + 1);
                        if (hook) {
                            uintptr_t ds_offset = 0;
                            bool read_only = true;
                            for (int k = 0; k < data_segment_count; k++) {
                                if (data_segments[k].index == segment_index) {
                                    ds_offset = data_segments[k].offset;
                                    read_only = data_segments[k].read_only;
                                    break;
                                }
                            }
                            if (ds_offset) {
                                uintptr_t address = base_address + ds_offset + offset;
                                void** ptr = (void**) address;
                                if (*ptr != hook) {
                                    if (read_only) {
                                        // disable write protection
                                        int page_size = get_page_size();
                                        if (page_size == -1) {
                                            goto exit;
                                        }
                                        uintptr_t page_address = address & ~(page_size - 1);
                                        if (mprotect((void*) page_address, page_size, PROT_READ | PROT_WRITE) < 0) {
                                            goto exit;
                                        }
                                        // insert our hook
                                        *ptr = hook;
                                        // reenable write protection
                                        if (mprotect((void*) page_address, page_size, PROT_READ) < 0) {
                                            goto exit;
                                        }
                                    } else {
                                        *ptr = hook;
                                    }
                                }
                            }
                        }
                    }
                    uint32_t extra;
                    switch (opcode) {
                        case BIND_OPCODE_DO_BIND_ADD_ADDR_ULEB: {
                            extra = extract_uleb128(bytes, &j, &end);
                        } break;
                        case BIND_OPCODE_DO_BIND_ADD_ADDR_IMM_SCALED: {
                            extra = (immediate + 1) * sizeof(uintptr_t);
                        } break;
                        default: {
                            extra = 0;
                        }
                    }
                    offset += sizeof(uintptr_t) + extra;
                    symbol_name = NULL;
                } break;
                case BIND_OPCODE_DO_BIND_ULEB_TIMES_SKIPPING_ULEB: {
                    uint64_t count = extract_uleb128(bytes, &j, &end);
                    uint64_t skip = extract_uleb128(bytes, &j, &end);
                    offset += count * (sizeof(uintptr_t) + skip);
                } break;
                default: {
                    // invalid op code
                    end = 0;
                }
            }
        }
    }
exit:
    free(symbols);
    free(symbol_strs);
    for (int i = 0; i < 3; i++) {
        free(bindings[i].byte_codes);
    }
    close(fd);
}
#else
void redirect_io_functions(void* handle,
                           const char* filename,
                           override_callback cb) {
}
#endif
