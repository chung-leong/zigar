#include "./redirect.h"

override_callback override = NULL;

#if defined(_WIN32)
#include <windows.h>
#include <imagehlp.h>

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

void patch_write_file(void* handle,
                      const char* filename,
                      override_callback cb) {
    PBYTE bytes = (PBYTE) handle;
    /* find IAT */ 
    ULONG size;
    PVOID data = ImageDirectoryEntryToDataEx(handle, TRUE, IMAGE_DIRECTORY_ENTRY_IMPORT, &size, NULL);
    PIMAGE_IMPORT_DESCRIPTOR iat_entry = (PIMAGE_IMPORT_DESCRIPTOR) data;
    /* look for kernel32.dll*/
    while (iat_entry->Characteristics && iat_entry->Name) {
        PSTR import_name = (PSTR) (bytes + iat_entry->Name);
        if (_stricmp(import_name, "kernel32.dll") == 0) {
            PIMAGE_THUNK_DATA thunk = (PIMAGE_THUNK_DATA) (bytes + iat_entry->FirstThunk);
            while (thunk->u1.Function) {
                PROC* fn_pointer = (PROC*) &thunk->u1.Function;
                if (*fn_pointer == (PROC) WriteFile) {
                    /* make page writable */ 
                    MEMORY_BASIC_INFORMATION mbi;
                    DWORD protect = PAGE_READWRITE;
                    VirtualQuery(fn_pointer, &mbi, sizeof(MEMORY_BASIC_INFORMATION));
                    if (VirtualProtect(mbi.BaseAddress, mbi.RegionSize, protect, &mbi.Protect)) {
                        /* replace with hook */
                        *fn_pointer = (PROC) write_file_hook;
                        override = cb;
                        /* restore original flags */
                        VirtualProtect(mbi.BaseAddress, mbi.RegionSize, mbi.Protect, &protect);
                    }
                    break;
                } else {
                    thunk++;
                }
            }
            break;
        }
    }
}
#elif defined(__ELF__)
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <dlfcn.h>
#include <unistd.h>
#include <sys/mman.h>
#include <elf.h>

#if defined __x86_64 || defined __aarch64__
    #define Elf_Ehdr Elf64_Ehdr
    #define Elf_Shdr Elf64_Shdr
    #define Elf_Sym Elf64_Sym
    #define Elf_Rel Elf64_Rela
    #define ELF_R_SYM ELF64_R_SYM
    #define ELF_ST_BIND ELF64_ST_BIND
    #define REL_PLT ".rela.plt"    
#else
    #define Elf_Ehdr Elf32_Ehdr
    #define Elf_Shdr Elf32_Shdr
    #define Elf_Sym Elf32_Sym
    #define Elf_Rel Elf32_Rel
    #define ELF_R_SYM ELF32_R_SYM
    #define ELF_ST_BIND ELF32_ST_BIND
    #define REL_PLT ".rel.plt"
#endif

ssize_t write_hook(int fd, 
                   const void* buffer, 
                   size_t len) {    
    if (fd == 1 || fd == 2) {   /* 1 = stdout, 2 = stderr */
        /* return value of zero means success */
        if (override(buffer, len) == 0) {
            return len;
        }
    }
    return write(fd, buffer, len);
}

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

void patch_write_file(void* handle,
                      const char* filename,
                      override_callback cb) {
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
    const char* func_name = "write";
    Elf_Sym* symbols = NULL;
    size_t symbol_count = 0;
    char* symbol_strs = NULL;
    Elf_Shdr* rela_plt = NULL;
    for (int i = 0; i < header.e_shnum; i++) {
        switch (sections[i].sh_type) {
            case SHT_RELA: {
                /* see if it holds the PLT */
                Elf_Shdr* rela = &sections[i]; 
                const char* name = section_strs + rela->sh_name;
                if (strcmp(name, REL_PLT) == 0) {
                    rela_plt = rela;
                }
            } break;
            case SHT_DYNSYM: {
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
            } break;
        }
    }
    if (!symbols || !rela_plt) {
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
    /* look for symbol for write() */
    for (int i = 0; i < symbol_count; i++) {
        const char* symbol_name = symbol_strs + symbols[i].st_name;
        if (strcmp(symbol_name, func_name) == 0) {
            Elf_Rel* plt_entries = (Elf_Rel*) (base_address + rela_plt->sh_addr);
            size_t plt_entry_count = rela_plt->sh_size / sizeof(Elf_Rel);
            for (int j = 0; j < plt_entry_count; j++) {
                if (ELF_R_SYM(plt_entries[j].r_info) == i) {
                    /* get address to GOT entry */
                    uintptr_t got_entry_address = base_address + plt_entries[j].r_offset;
                    /* disable write protection */
                    int page_size = sysconf(_SC_PAGE_SIZE);
                    if (page_size == -1) {
                        goto exit;
                    }
                    uintptr_t page_address = got_entry_address & ~(page_size - 1);
                    if (mprotect((void*) page_address, page_size, PROT_READ | PROT_WRITE) < 0) {
                        goto exit;
                    }
                    void** ptr = (void **) got_entry_address;
                    *ptr = write_hook;
                    override = cb;
                    /* reenable write protection */
                    mprotect((void*) page_address, page_size, PROT_READ);
                    break;
                }
            }
            break;
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
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <dlfcn.h>
#include <unistd.h>
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

ssize_t write_hook(int fd, 
                   const void* buffer, 
                   size_t len) {    
    if (fd == 1 || fd == 2) {   /* 1 = stdout, 2 = stderr */
        /* return value of zero means success */
        if (override(buffer, len) == 0) {
            return len;
        }
    }
    return write(fd, buffer, len);
}

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

void patch_write_file(void* handle,
                      const char* filename,
                      override_callback cb) {
    int fd = open(filename, O_RDONLY);
    if (fd <= 0) {
        return;
    }
    const char* func_name = "_write";
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
	for(int i = 0; i < header.ncmds; i++) {
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
        if (strcmp(symbol_name, func_name) == 0) {
            /* calculate the address to the GOT entry */
            uintptr_t got_entry_address = base_address + got_offset + (i * sizeof(void*));
            void** ptr = (void**) got_entry_address;
            /* insert our hook */
            *ptr = write_hook;
            override = cb;
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
void patch_write_file(void* handle,
                      const char* filename,
                      override_callback cb) {
}
#endif

