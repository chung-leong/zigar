#ifndef _DLFCN_WIN32_H_
#define _DLFCN_WIN32_H_
#include <windows.h>
#define RTLD_LAZY   0
#define RTLD_NOW    0

inline void* dlopen(const char* filename, int flags) {
  return (void*) LoadLibraryA(filename);
}

inline int dlclose(void* handle) {
  return FreeLibrary((HMODULE) handle) ? 0 : 1;
}

inline void* dlsym(void* handle, const char* symbol) {
  return GetProcAddress((HMODULE) handle, symbol);
}

#endif