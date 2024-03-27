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
#include <elf.h>
#include <fcntl.h>
#include <link.h>
#include <dlfcn.h>
#include <unistd.h>
#include <sys/mman.h>

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
    int func_index = -1;
    Elf_Shdr* rela_plt = NULL;
    uintptr_t base_address = 0;
    /* look for dynsym and PLT */
    for (int i = 0; i < header.e_shnum && (!rela_plt || !base_address); i++) {
        switch (sections[i].sh_type) {
            case SHT_DYNSYM: {
                Elf_Shdr* dynsym = &sections[i];
                Elf_Sym* symbols = malloc(dynsym->sh_size);
                size_t symbol_count = dynsym->sh_size / sizeof(Elf_Sym);
                char* symbol_strs = NULL;
                if (!symbols
                 || lseek(fd, dynsym->sh_offset, SEEK_SET) < 0 
                 || read(fd, symbols, dynsym->sh_size) <= 0
                 || read_string_table(fd, &sections[dynsym->sh_link], &symbol_strs) == 0) {
                    free(symbols);
                    goto exit;
                }
                /* look for symbol for write() */
                for (int j = 0; j < symbol_count; j++) {
                    const char* symbol_name = symbol_strs + symbols[j].st_name;
                    if (strcmp(symbol_name, func_name) == 0) {
                        func_index = j;
                        break;
                    }
                }
                /* find base address of library */
                for (int j = 0; j < symbol_count; j++) {
                    const int binding = ELF_ST_BIND(symbols[j].st_info);
                    if ((binding == STB_GLOBAL || binding == STB_WEAK) && symbols[j].st_value != 0) {
                        const char* symbol_name = symbol_strs + symbols[j].st_name;
                        void *symbol = dlsym(handle, symbol_name);
                        if(symbol != NULL) {
                            base_address = ((uintptr_t) symbol) - symbols[j].st_value;
                            break;
                        }
                    }
                }
                free(symbol_strs);
                free(symbols);
            } break;
            case SHT_RELA: {
                /* look for PLT */
                Elf_Shdr* rela = &sections[i]; 
                const char* name = section_strs + rela->sh_name;
                if (strcmp(name, REL_PLT) == 0) {
                    rela_plt = rela;
                }
            } break;
        }
    }
    if (rela_plt && base_address != 0 && func_index != -1) {
        Elf_Rel* plt_entries = (Elf_Rel*) (base_address + rela_plt->sh_addr);
        size_t plt_entry_count = rela_plt->sh_size / sizeof(Elf_Rel);
        /* look for PLT entry for write() */
        for (int i = 0; i < plt_entry_count; i++) {
            if (ELF_R_SYM(plt_entries[i].r_info) == func_index) {
                /* get address to GOT entry */
                uintptr_t got_entry_address = base_address + plt_entries[i].r_offset;
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
    }
exit:
    free(sections);
    free(section_strs);
    close(fd);
}
#elif defined(__MACH__)
void patch_write_file(void* handle,
                      const char* filename,
                      override_callback cb) {
}
#else
void patch_write_file(void* handle,
                      const char* filename,
                      override_callback cb) {
}
#endif

