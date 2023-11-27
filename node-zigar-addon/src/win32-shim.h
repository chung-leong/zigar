#ifndef _WIN32_SHIM_H_
#define _WIN32_SHIM_H_
#include <stdbool.h>

#define RTLD_LAZY   0
#define RTLD_NOW    0

inline void* dlopen(const char* filename, 
                    int flags) {
    return (void*) LoadLibraryA(filename);
}

inline void* dlsym(void* handle, 
                   const char* symbol) {
    return GetProcAddress((HMODULE) handle, symbol);
}

inline int dlclose(void* handle) {
    return FreeLibrary((HMODULE) handle) ? 0 : 1;
}

typedef int (*override_callback)(const void*, size_t);

void patch_write_file(void* handle,
                      override_callback cb);

#endif