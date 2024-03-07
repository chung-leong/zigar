#include "./win32-shim.h"

override_callback override = NULL;

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

extern const IMAGE_DOS_HEADER __ImageBase;

FORCEINLINE PVOID PFromRva(RVA rva) {
    return (PVOID)(((ULONG_PTR)(rva)) + ((ULONG_PTR)&__ImageBase));
}
 
__declspec(dllexport) 
FARPROC WINAPI __delayLoadHelper2(PCImgDelayDescr descr, 
                                  PImgThunkData iat_entry) {
    HMODULE* module_ptr = PFromRva(descr->rvaHmod);
    HMODULE module = *module_ptr;
    if (!module) {
        LPCSTR dll_name = PFromRva(descr->rvaDLLName);
        if (_stricmp(dll_name, "NODE.EXE") != 0) {
            return NULL;
        }
        /* get handle of executable */
        module = *module_ptr = GetModuleHandle(NULL);
    }
    PImgThunkData im_addr_tbl = PFromRva(descr->rvaIAT);
    PImgThunkData im_name_tbl = PFromRva(descr->rvaINT);
    PImgThunkData int_entry = &im_name_tbl[iat_entry - im_addr_tbl];
    LPCSTR proc_name;
    if (!IMAGE_SNAP_BY_ORDINAL(int_entry->u1.Ordinal)) {
        PIMAGE_IMPORT_BY_NAME by_name = PFromRva((RVA) int_entry->u1.AddressOfData);
        proc_name = (LPCSTR) &by_name->Name;
    } else {
        proc_name = (LPCSTR) IMAGE_ORDINAL(int_entry->u1.Ordinal); 
    }    
    FARPROC proc = GetProcAddress(module, proc_name);
    iat_entry->u1.Function = (DWORD_PTR) proc;
    return proc;
}
