#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#define MODULE_VISIBILITY  __attribute__ ((visibility ("hidden")))

size_t redirected_fread(const char* buffer, size_t size, size_t n, FILE* s);
size_t redirected_fwrite(const char* buffer, size_t size, size_t n, FILE* s);
bool is_redirected_file(FILE* s);

MODULE_VISIBILITY int (*vfprintf_orig)(FILE* s, const char* f, va_list arg);
MODULE_VISIBILITY int vfprintf_hook(FILE* s, const char* f, va_list arg) {
    if (is_redirected_file(s)) {
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
        size_t written = redirected_fwrite(buffer, 1, len, s);
        if (too_large) {
            free(buffer);
        }
        return written;
    }
    return vfprintf_orig(s, f, arg);
}

MODULE_VISIBILITY int (*vprintf_orig)(const char* f, va_list arg);
MODULE_VISIBILITY int vprintf_hook(const char* f, va_list arg) {
    return vfprintf_hook(stdout, f, arg);
}

MODULE_VISIBILITY int (*fprintf_orig)(FILE* s, const char* f, ...);
MODULE_VISIBILITY int fprintf_hook(FILE* s, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*printf_orig)(const char* f, ...);
MODULE_VISIBILITY int printf_hook(const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}

#if defined(_STDC_WANT_LIB_EXT1_) 
MODULE_VISIBILITY int (*vfprintf_s_orig)(FILE* s, const char* f, va_list arg)
MODULE_VISIBILITY int vfprintf_s_hook(FILE* s, const char* f, va_list arg) {
    // TODO
    return vfprintf_s_orig(s, f, arg);
}

MODULE_VISIBILITY int (*vprintf_s_orig)(const char* f, va_list arg);
MODULE_VISIBILITY int vprintf_s_hook(const char* f, va_list arg) {
    return vfprintf_s_hook(stdout, f, arg);
}

MODULE_VISIBILITY int (*fprintf_s_orig)(FILE* s, const char* f, ...)
MODULE_VISIBILITY int fprintf_s_hook(FILE* s, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_s_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*printf_s_hook)(const char* f, ...);
MODULE_VISIBILITY int printf_s_hook(const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_s_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}
#endif

#if defined(__GLIBC__)
MODULE_VISIBILITY int (*vfprintf_chk_orig)(FILE* s, int flag, const char* f, va_list arg);
MODULE_VISIBILITY int vfprintf_chk_hook(FILE* s, int flag, const char* f, va_list arg) {
    return vfprintf_hook(s, f, arg);
}

MODULE_VISIBILITY int (*vprintf_chk_orig)(int flag, const char* f, va_list arg);
MODULE_VISIBILITY int vprintf_chk_hook(int flag, const char* f, va_list arg) {
    return vfprintf_chk_hook(stdout, flag, f, arg);
}

MODULE_VISIBILITY int (*fprintf_chk_orig)(FILE* s, int flag, const char* f, ...);
MODULE_VISIBILITY int fprintf_chk_hook(FILE* s, int flag, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(s, flag, f, argptr);
    va_end(argptr);
    return n;
}

MODULE_VISIBILITY int (*printf_chk_orig)(int flag, const char* f, ...);
MODULE_VISIBILITY int printf_chk_hook(int flag, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(stdout, flag, f, argptr);
    va_end(argptr);
    return n;
}
#endif
