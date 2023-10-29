#include <windows.h>

inline void* dlopen(const char* filename, int flags) {
  return reinterpret_cast<void*>(LoadLibraryA(filename));
}

inline int dlclose(void* handle) {
  return FreeLibrary(reinterpret_cast<HMODULE>(handle)) ? 0 : 1;
}

inline void* dlsym(void* handle, const char* symbol) {
  return GetProcAddress(reinterpret_cast<HMODULE>(handle), symbol);
}
