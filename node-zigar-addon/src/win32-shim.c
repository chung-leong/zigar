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
