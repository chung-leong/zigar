#define _GNU_SOURCE
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#ifdef _WIN32
    #include <windows.h>
    #define MODULE_VISIBILITY  
#else
    #include <dlfcn.h>
    #define MODULE_VISIBILITY  __attribute__ ((visibility ("hidden")))
#endif

int redirected_read(void*, char*, int);
int redirected_write(void*, const char*, int);
void* get_redirected_file(FILE*);
extern char* get_line(void*);

bool load_vfprintf(void);
bool load_vfscanf(void);

MODULE_VISIBILITY int (*vfprintf_orig)(FILE* s, const char* f, va_list arg) = NULL;
MODULE_VISIBILITY int vfprintf_hook(FILE* s, const char* f, va_list arg) {
    void* file = get_redirected_file(s);
    if (file) {
        // attempt with fixed-size buffer, using a copy of arg
        va_list arg_copy;
        va_copy(arg_copy, arg);
        char fixed_buffer[1024];
        char* buffer = fixed_buffer;
        int len = vsnprintf(fixed_buffer, sizeof(fixed_buffer), f, arg_copy);
        bool too_large = len + 1 > sizeof(fixed_buffer);
        if (too_large) {
            va_copy(arg_copy, arg);
            buffer = malloc(len + 1);
            vsnprintf(buffer, len + 1, f, arg_copy);
        }
        int written = redirected_write(file, buffer, len);
        if (too_large) {
            free(buffer);
        }
        return written;
    }
    return vfprintf_orig(s, f, arg);
}

MODULE_VISIBILITY int (*vprintf_orig)(const char* f, va_list arg) = NULL;
MODULE_VISIBILITY int vprintf_hook(const char* f, va_list arg) {
    if (!load_vfprintf()) return -1;
    return vfprintf_hook(stdout, f, arg);
}

MODULE_VISIBILITY int (*fprintf_orig)(FILE* s, const char* f, ...) = NULL;
MODULE_VISIBILITY int fprintf_hook(FILE* s, const char* f, ...) {
    if (!load_vfprintf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*printf_orig)(const char* f, ...) = NULL;
MODULE_VISIBILITY int printf_hook(const char* f, ...) {
    if (!load_vfprintf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*__vfprintf_chk_orig)(FILE* s, int flag, const char* f, va_list arg) = NULL;
MODULE_VISIBILITY int __vfprintf_chk_hook(FILE* s, int flag, const char* f, va_list arg) {
    if (!load_vfprintf()) return -1;
    return vfprintf_hook(s, f, arg);
}

MODULE_VISIBILITY int (*__vprintf_chk_orig)(int flag, const char* f, va_list arg) = NULL;
MODULE_VISIBILITY int __vprintf_chk_hook(int flag, const char* f, va_list arg) {
    if (!load_vfprintf()) return -1;
    return vfprintf_hook(stdout, f, arg);
}

MODULE_VISIBILITY int (*__fprintf_chk_orig)(FILE* s, int flag, const char* f, ...) = NULL;
MODULE_VISIBILITY int __fprintf_chk_hook(FILE* s, int flag, const char* f, ...) {
    if (!load_vfprintf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*__printf_chk_orig)(int flag, const char* f, ...) = NULL;
MODULE_VISIBILITY int __printf_chk_hook(int flag, const char* f, ...) {
    if (!load_vfprintf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*vfscanf_orig)(FILE* s, const char *f, va_list arg) = NULL;
MODULE_VISIBILITY int vfscanf_hook(FILE* s, const char *f, va_list arg) {
    void* file = get_redirected_file(s);
    if (file) {
        char* line = get_line(file);
        if (!line) {
            return EOF;
        }
        return vsscanf(line, f, arg);
    }
    return vfscanf_orig(s, f, arg);
}

MODULE_VISIBILITY int (*vscanf_orig)(FILE* s, const char *f, va_list arg) = NULL;
MODULE_VISIBILITY int vscanf_hook(FILE* s, const char *f, va_list arg) {
    if (!load_vfscanf()) return -1;
    return vfscanf_hook(stdin, f, arg);
}

MODULE_VISIBILITY int (*fscanf_orig)(FILE* s, const char *f, ...) = NULL;
MODULE_VISIBILITY int fscanf_hook(FILE* s, const char *f, ...) {
    if (!load_vfscanf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfscanf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*scanf_orig)(const char *f, ...) = NULL;
MODULE_VISIBILITY int scanf_hook(const char *f, ...) {
    if (!load_vfscanf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfscanf_hook(stdin, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*__isoc99_vfscanf_orig)(FILE* s, const char *f, va_list arg) = NULL;
MODULE_VISIBILITY int __isoc99_vfscanf_hook(FILE* s, const char *f, va_list arg) {
    if (!load_vfscanf()) return -1;
    return vfscanf_hook(s, f, arg);
}

MODULE_VISIBILITY int (*__isoc99_vscanf_orig)(FILE* s, const char *f, va_list arg) = NULL;
MODULE_VISIBILITY int __isoc99_vscanf_hook(FILE* s, const char *f, va_list arg) {
    if (!load_vfscanf()) return -1;
    return vfscanf_hook(stdin, f, arg);
}

MODULE_VISIBILITY int (*__isoc99_fscanf_orig)(FILE* s, const char *f, ...) = NULL;
MODULE_VISIBILITY int __isoc99_fscanf_hook(FILE* s, const char *f, ...) {
    if (!load_vfscanf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfscanf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*__isoc99_scanf_orig)(const char *f, ...) = NULL;
MODULE_VISIBILITY int __isoc99_scanf_hook(const char *f, ...) {
    if (!load_vfscanf()) return -1;
    va_list argptr;
    va_start(argptr, f);
    int n = vfscanf_hook(stdin, f, argptr);
    va_end(argptr);
    return n;
}

#if defined(_WIN32)
MODULE_VISIBILITY int (*__stdio_common_vfprintf_orig)(unsigned __int64 options, FILE* s, char const* f, _locale_t locale, va_list arg) = NULL;
MODULE_VISIBILITY int __stdio_common_vfprintf_hook(unsigned __int64 options, FILE* s, char const* f, _locale_t locale, va_list arg) {
    void* file = get_redirected_file(s);
    if (file) {
        // attempt with fixed-size buffer, using a copy of arg
        va_list arg_copy;
        va_copy(arg_copy, arg);
        char fixed_buffer[1024];
        char* buffer = fixed_buffer;
        int len = __stdio_common_vsnprintf_s(options, fixed_buffer, sizeof(fixed_buffer), sizeof(fixed_buffer) - 1, f, locale, arg_copy);
        bool too_large = len + 1 > sizeof(fixed_buffer);
        if (too_large) {
            va_copy(arg_copy, arg);
            buffer = malloc(len + 1);
            __stdio_common_vsnprintf_s(options, fixed_buffer, len + 1, len, f, locale, arg_copy);
            vsnprintf(buffer, len + 1, f, arg_copy);
        }
        int written = redirected_write(file, buffer, len);
        if (too_large) {
            free(buffer);
        }
        return written;
    }
    return __stdio_common_vfprintf_orig(options, s, f, locale, arg);
}

MODULE_VISIBILITY int (*__stdio_common_vfscanf_orig)(unsigned __int64 options, FILE* s, char const* f, _locale_t locale, va_list arg) = NULL;
MODULE_VISIBILITY int __stdio_common_vfscanf_hook(unsigned __int64 options, FILE* s, char const* f, _locale_t locale, va_list arg) {
    void* file = get_redirected_file(s);
    if (file) {
        char* line = get_line(file);
        if (!line) {
            return EOF;
        }
        size_t len = strlen(line);
        return __stdio_common_vsscanf(options, line, len, f, locale, arg);
    }
    return __stdio_common_vfscanf_orig(options, s, f, locale, arg);
}
#endif

bool load_orig_func(void** orig_ptr, void *other_fn, const char* name) {
    if (*orig_ptr) return true;
    void* addr = NULL;
#if defined(_WIN32)
    HMODULE handle;
    if (GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, other_fn, &handle)) {
        addr = GetProcAddress(handle, name);
    }
#else
    Dl_info info;
    if (dladdr(other_fn, &info)) {
        void* handle = dlopen(info.dli_fname, RTLD_LAZY);
        if (handle) {
            addr = dlsym(handle, name);
            dlclose(handle);
        }
    }
#endif
    if (!addr) return false;
    *orig_ptr = addr;
    return true;
}

// set vfprintf_orig when vfprintf itself isn't begin hooked
bool load_vfprintf(void) {
#ifdef __LINUX__
    return load_orig_func(&vfprintf_orig, memset, "vfprintf");
#else
    return load_orig_func(&vfprintf_orig, vsnprintf, "vfprintf");
#endif
}

// set vfscanf_orig when vfscanf itself isn't begin hooked
bool load_vfscanf(void) {
#ifdef __LINUX__
    return load_orig_func(&vfscanf_orig, memset, "vfscanf");
#else 
    return load_orig_func(&vfscanf_orig, vsscanf, "vfscanf");
#endif
}
