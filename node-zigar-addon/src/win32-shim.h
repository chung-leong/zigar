#ifndef _WIN32_SHIM_H_
#define _WIN32_SHIM_H_
#include <stdbool.h>

#define RTLD_LAZY   0
#define RTLD_NOW    0

void* dlopen(const char* filename, int flags);
void* dlsym(void* handle, const char* symbol);
int dlclose(void* handle);

typedef bool (*override_callback)(void*, const void*, size_t);
void override_write_file(override_callback cb, void* opaque);
void end_override();

#endif