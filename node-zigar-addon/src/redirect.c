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
        /* return value of zero means success */
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
    void* hook;
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
            return hooks[i].hook;
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
    /* find IAT */
    ULONG size;
    PVOID data = ImageDirectoryEntryToDataEx(handle, TRUE, IMAGE_DIRECTORY_ENTRY_IMPORT, &size, NULL);
    PIMAGE_IMPORT_DESCRIPTOR import_desc = (PIMAGE_IMPORT_DESCRIPTOR) data;
    for (PIMAGE_IMPORT_DESCRIPTOR entry = import_desc; entry->Characteristics && entry->Name; entry++) {
        /* look for kernel32.dll*/
        PSTR import_name = (PSTR) (bytes + entry->Name);
        PIMAGE_THUNK_DATA addr_table = (PIMAGE_THUNK_DATA) (bytes + entry->FirstThunk);
        PIMAGE_THUNK_DATA name_table = (PIMAGE_THUNK_DATA) (bytes + entry->OriginalFirstThunk);
        for (PIMAGE_THUNK_DATA iat_ptr = addr_table, int_ptr = name_table; iat_ptr->u1.Function; iat_ptr++, int_ptr++) {
            if (!IMAGE_SNAP_BY_ORDINAL(int_ptr->u1.Ordinal)) {
                PIMAGE_IMPORT_BY_NAME ibm_ptr = (PIMAGE_IMPORT_BY_NAME) (bytes + int_ptr->u1.AddressOfData);
                void* hook = find_hook(ibm_ptr->Name);
                if (hook) {
                    PROC* fn_pointer = (PROC*) &iat_ptr->u1.Function;
                    /* make page writable */
                    MEMORY_BASIC_INFORMATION mbi;
                    DWORD protect = PAGE_READWRITE;
                    VirtualQuery(fn_pointer, &mbi, sizeof(MEMORY_BASIC_INFORMATION));
                    if (VirtualProtect(mbi.BaseAddress, mbi.RegionSize, protect, &mbi.Protect)) {
                        /* replace with hook */
                        *fn_pointer = hook;
                        /* restore original flags */
                        VirtualProtect(mbi.BaseAddress, mbi.RegionSize, mbi.Protect, &protect);
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

int extract_string_table(int fd,
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
    /* read ELF header */
    Elf_Ehdr header;
    if (read(fd, &header, sizeof(header)) <= 0) {
        goto exit;
    }
    /* read all sections */
    sections = malloc(header.e_shnum * sizeof(Elf_Shdr));
    if (!sections
     || lseek(fd, header.e_shoff, SEEK_SET) < 0
     || read(fd, sections, header.e_shnum * sizeof(Elf_Shdr)) <= 0
     || extract_string_table(fd, &sections[header.e_shstrndx], &section_strs) == 0) {
        goto exit;
    }
    Elf_Sym* symbols = NULL;
    size_t symbol_count = 0;
    char* symbol_strs = NULL;
    /* find symbol table */
    for (int i = 0; i < header.e_shnum; i++) {
        if (sections[i].sh_type == SHT_DYNSYM) {
            /* load symbols */
            Elf_Shdr* dynsym = &sections[i];
            symbols = malloc(dynsym->sh_size);
            symbol_count = dynsym->sh_size / sizeof(Elf_Sym);
            if (!symbols
                || lseek(fd, dynsym->sh_offset, SEEK_SET) < 0
                || read(fd, symbols, dynsym->sh_size) <= 0
                || extract_string_table(fd, &sections[dynsym->sh_link], &symbol_strs) == 0) {
                goto exit;
            }
            break;
        }
    }
    if (!symbols) {
        goto exit;
    }
    /* find base address of library */
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
    /* scan through relocations */
    for (int i = 0; i < header.e_shnum; i++) {
        if (sections[i].sh_type == SHT_RELA) {
            Elf_Shdr* rela = &sections[i];
            Elf_Rel* rela_entries = (Elf_Rel*) (base_address + rela->sh_addr);
            size_t rela_entry_count = rela->sh_size / sizeof(Elf_Rel);
            for (int i = 0; i < rela_entry_count; i++) {
                size_t symbol_index = ELF_R_SYM(rela_entries[i].r_info);
                if (symbol_index) {
                    const char* symbol_name = symbol_strs + symbols[symbol_index].st_name;
                    void* hook = find_hook(symbol_name);
                    if (hook) {
                        /* get address to GOT entry */
                        uintptr_t got_entry_address = base_address + rela_entries[i].r_offset;
                        /* disable write protection */
                        int page_size = get_page_size();
                        if (page_size == -1) {
                            goto exit;
                        }
                        uintptr_t page_address = got_entry_address & ~(page_size - 1);
                        if (mprotect((void*) page_address, page_size, PROT_READ | PROT_WRITE) < 0) {
                            goto exit;
                        }
                        void** ptr = (void **) got_entry_address;
                        *ptr = hook;
                        override = cb;
                        /* reenable write protection */
                        mprotect((void*) page_address, page_size, PROT_READ);
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
typedef struct dyld_info_command            dyld_info_command;
typedef struct ADD_BITS(segment_command)    segment_command;

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

const char* extract_string(const uint8_t* bytes, uint32_t* pos, uint32_t* end) {
    const char* s = (const char*) &bytes[*pos + 1];
    for (uint32_t i = *pos + 1; i < *end; i++) {
        if (bytes[i] == 0) {
            *pos = i;
            break;
        }
    }
    return s;
}

uint64_t extract_uleb128(const uint8_t* bytes, uint32_t* pos, uint32_t* end) {
    uint64_t result = 0;
    int bit = 0;
    for (uint32_t i = *pos + 1; i < *end; i++) {
        uint8_t byte = bytes[i];
        uint64_t slice = byte & 0x7f;
        if (bit >= 64 || slice << bit >> bit != slice) {
            *end = 0;
            break;
        } else {
            result |= (slice << bit);
            bit += 7;
        }
        if (!(byte & 0x80)) {
            *pos = i;
            break;
        }
    }
    printf("uleb: %zu\n", result);
    return result;
}

int64_t extract_sleb128(const uint8_t* bytes, uint32_t* pos, uint32_t* end) {
    int64_t result = 0;
    int bit;
    for (uint32_t i = *pos + 1; i < *end; i++) {
        uint8_t byte = bytes[i];
        result |= ((byte & 0x7f) << bit);
        bit += 7;
        if (!(byte & 0x80)) {
            if ((byte & 0x40) != 0) {
                result |= (-1LL) << bit;
            }
            *pos = i;
            break;
        }
    }
    printf("sleb: %zd\n", result);
    return result;
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
    uint32_t data_segment_offset;
    uint32_t data_segment_index;
    uintptr_t base_address = 0;
    /* read mach-o header */
	mach_header header;
	if(read(fd, &header, sizeof(header)) < 0) {
		goto exit;
	}
    load_command load_cmd;
	off_t pos = sizeof(mach_header);
    /* process mach-o commands */
	for (int i = 0; i < header.ncmds; i++) {
		if(lseek(fd, pos, SEEK_SET) < 0 || read(fd, &load_cmd, sizeof(load_cmd)) <= 0) {
			goto exit;
		}
        switch (load_cmd.cmd) {
            case ADD_BITS(LC_SEGMENT): {
                /* look for data sections */
                segment_command seg_cmd;
                if (read_command(fd, &load_cmd, &seg_cmd, sizeof(seg_cmd)) == 0) {
                    goto exit;
                }
                if (strcmp(seg_cmd.segname, SEG_DATA) == 0) {
                    data_segment_offset = seg_cmd.vmaddr;
                    data_segment_index = segment_count;
                    printf("DATA: %zu %zu\n\n", data_segment_offset, data_segment_index);
                }
                segment_count++;
            } break;
            case LC_DYLD_INFO:
            case LC_DYLD_INFO_ONLY: {
                dyld_info_command info_cmd;
                if (read_command(fd, &load_cmd, &info_cmd, sizeof(info_cmd)) == 0) {
                    goto exit;
                }
                uint32_t bind_offsets[3] = { info_cmd.bind_off, info_cmd.weak_bind_off, info_cmd.lazy_bind_off };
                uint32_t bind_size[3] = { info_cmd.bind_size, info_cmd.weak_bind_size, info_cmd.lazy_bind_size };
                for (int i = 1; i < 2; i++) {
                    if (bind_size[i] == 0) continue;
                    uint8_t *byte_codes = malloc(bind_size[i]);
                    if (!byte_codes
                    || lseek(fd, bind_offsets[i], SEEK_SET) < 0
                    || read(fd, byte_codes, bind_size[i]) <= 0) {
                        free(byte_codes);
                        goto exit;
                    }
		            uint8_t type = 0;
		            uint8_t flags;
		            uint64_t offset = 0;
		            const char* symbol_name = NULL;
		            uint32_t segment_index = 0;
		            uint32_t byte_code_count = bind_size[i];
                    for (uint32_t j = 0; j < byte_code_count; j++) {
                        uint8_t byte = byte_codes[j];
                        uint8_t immediate = byte & BIND_IMMEDIATE_MASK;
                        uint8_t opcode = byte & BIND_OPCODE_MASK;
                        switch (opcode) {
                            case BIND_OPCODE_DONE: {
                                // byte_code_count = 0;
                                printf("BIND_OPCODE_DONE\n");
                            } break;
                            case BIND_OPCODE_SET_DYLIB_ORDINAL_IMM: {
                                uint64_t library_ordinal = immediate;
                                printf("BIND_OPCODE_SET_DYLIB_ORDINAL_IMM\n");
                            } break;
                            case BIND_OPCODE_SET_DYLIB_ORDINAL_ULEB: {
                                uint64_t library_ordinal = extract_uleb128(byte_codes, &j, &byte_code_count);
                                printf("BIND_OPCODE_SET_DYLIB_ORDINAL_ULEB\n");
                            } break;
                            case BIND_OPCODE_SET_DYLIB_SPECIAL_IMM: {
                                if (immediate == 0) {
                                    uint64_t library_ordinal = 0;
                                } else {
                                    int8_t sign_extended = BIND_OPCODE_MASK | immediate;
                                    uint64_t library_ordinal = sign_extended;
                                }
                                printf("BIND_OPCODE_SET_DYLIB_SPECIAL_IMM\n");
                            } break;
                            case BIND_OPCODE_SET_SYMBOL_TRAILING_FLAGS_IMM: {
                                flags = immediate;
                                symbol_name = extract_string(byte_codes, &j, &byte_code_count);
                                printf("BIND_OPCODE_SET_SYMBOL_TRAILING_FLAGS_IMM\n");
                                //printf("symbol = %s\n", symbol_name);
                            } break;
                            case BIND_OPCODE_SET_TYPE_IMM: {
                                type = immediate;
                                printf("BIND_OPCODE_SET_TYPE_IMM\n");
                            } break;
                            case BIND_OPCODE_SET_ADDEND_SLEB: {
                                int64_t addend = extract_sleb128(byte_codes, &j, &byte_code_count);
                                printf("BIND_OPCODE_SET_ADDEND_SLEB\n");
                            } break;
                            case BIND_OPCODE_SET_SEGMENT_AND_OFFSET_ULEB: {
                                segment_index = immediate;
                                offset = extract_uleb128(byte_codes, &j, &byte_code_count);
                                printf("BIND_OPCODE_SET_SEGMENT_AND_OFFSET_ULEB\n");
                            } break;
                            case BIND_OPCODE_ADD_ADDR_ULEB: {
                                offset += extract_uleb128(byte_codes, &j, &byte_code_count);
                                printf("BIND_OPCODE_ADD_ADDR_ULEB\n");
                            } break;
            				case BIND_OPCODE_DO_BIND:
				            case BIND_OPCODE_DO_BIND_ADD_ADDR_ULEB:
                            case BIND_OPCODE_DO_BIND_ADD_ADDR_IMM_SCALED: {
                                /* here's where we do the lookup */
                                if (symbol_name) {
                                    printf("%s => %zu, %d, %d, %d\n", symbol_name, segment_index, offset, type, flags);
                                }
                                uint32_t extra = 0;
                                switch (opcode) {
                                    case BIND_OPCODE_DO_BIND_ADD_ADDR_ULEB: {
                    					extra = extract_uleb128(byte_codes, &j, &byte_code_count);
                                        printf("BIND_OPCODE_DO_BIND_ADD_ADDR_ULEB\n");
                                    } break;
                                    case BIND_OPCODE_DO_BIND_ADD_ADDR_IMM_SCALED: {
        			            		extra = (immediate + 1) * sizeof(uintptr_t);
                                        printf("BIND_OPCODE_DO_BIND_ADD_ADDR_IMM_SCALED\n");
                                    } break;
                                    default: {
                                        extra = 0;
                                        printf("BIND_OPCODE_DO_BIND\n");
                                    }
                                }
                                offset += sizeof(uintptr_t) + extra;
                                symbol_name = NULL;
                            } break;
                            case BIND_OPCODE_DO_BIND_ULEB_TIMES_SKIPPING_ULEB: {
            					uint64_t count = extract_uleb128(byte_codes, &j, &byte_code_count);
            					uint64_t skip = extract_uleb128(byte_codes, &j, &byte_code_count);
                                printf("BIND_OPCODE_DO_BIND_ULEB_TIMES_SKIPPING_ULEB\n");
                                offset += count * (sizeof(uintptr_t) + skip);
                            } break;
                            default: {
                                /* invalid op code*/
                                byte_code_count = 0;
                                printf("invalid opcode\n");
                            }
                        }
                    }
                    free(byte_codes);
                }
            } break;
        }
		pos += load_cmd.cmdsize;
    }

exit:
    close(fd);
}
#else
void redirect_io_functions(void* handle,
                           const char* filename,
                           override_callback cb) {
}
#endif
