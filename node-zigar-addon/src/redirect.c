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
     || read_string_table(fd, &sections[header.e_shstrndx], &section_strs) == 0) {
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
                || read_string_table(fd, &sections[dynsym->sh_link], &symbol_strs) == 0) {
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
typedef struct symtab_command			    symtab_command;
typedef struct dysymtab_command             dysymtab_command;
typedef struct ADD_BITS(segment_command)    segment_command;
typedef struct ADD_BITS(section)            section;
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

void redirect_io_functions(void* handle,
                           const char* filename,
                           override_callback cb) {
    override = cb;
    int fd = open(filename, O_RDONLY);
    if (fd <= 0) {
        return;
    }
    section* data_sections = NULL;
    size_t data_section_count = 0;
    nlist* symbols = NULL;
    size_t symbol_count = 0;
    char* symbol_strs = NULL;
    uint32_t* indirect_symbol_indices = NULL;
    size_t indirect_symbol_count = 0;
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
                    data_sections = malloc(seg_cmd.nsects * sizeof(section));
                    data_section_count = seg_cmd.nsects;
                    if (!data_sections || read(fd, data_sections, seg_cmd.nsects * sizeof(section)) <= 0) {
                        goto exit;
                    }
                }
            } break;
            case LC_SYMTAB: {
                /* load symbols */
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
            case LC_DYSYMTAB: {
                /* find out which symbols are indirect */
                dysymtab_command dysym_cmd;
                if (read_command(fd, &load_cmd, &dysym_cmd, sizeof(dysym_cmd)) == 0) {
                    goto exit;
                }
                indirect_symbol_indices = malloc(dysym_cmd.nindirectsyms * sizeof(uint32_t));
                indirect_symbol_count = dysym_cmd.nindirectsyms;
                if (!indirect_symbol_indices
                 || lseek(fd, dysym_cmd.indirectsymoff, SEEK_SET) < 0
                 || read(fd, indirect_symbol_indices, dysym_cmd.nindirectsyms * sizeof(uint32_t)) <= 0) {
                    goto exit;
                }
            } break;
        }
		pos += load_cmd.cmdsize;
    }
    if (!symbols || !indirect_symbol_indices || !data_sections) {
        goto exit;
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
    uintptr_t got_offset = 0;
    for (int i = 0; i < data_section_count; i++) {
        section* data_section = &data_sections[i];
        if ((data_section->flags & SECTION_TYPE) == S_LAZY_SYMBOL_POINTERS) {
            got_offset = data_section->addr;
            break;
        }
    }
    if (base_address == 0 || got_offset == 0) {
        goto exit;
    }
    for (int i = 0; i < indirect_symbol_count; i++) {
        nlist* symbol = &symbols[indirect_symbol_indices[i]];
        const char* symbol_name = symbol_strs + symbol->n_un.n_strx;
        void* hook = (symbol_name[0] == '_') ? find_hook(symbol_name + 1) : NULL;
        if (hook) {
            /* calculate the address to the GOT entry */
            uintptr_t got_entry_address = base_address + got_offset + (i * sizeof(void*));
            void** ptr = (void**) got_entry_address;
            /* insert our hook */
            *ptr = hook;
            break;
        }
    }

exit:
    free(data_sections);
    free(symbols);
    free(symbol_strs);
    free(indirect_symbol_indices);
    close(fd);
}
#else
void redirect_io_functions(void* handle,
                           const char* filename,
                           override_callback cb) {
}
#endif
