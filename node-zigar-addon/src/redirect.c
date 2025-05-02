#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>
#if defined(_WIN32)
    #include <windows.h>
    #include <io.h>
#else
    #include <unistd.h>
#endif

typedef uint32_t (*override_callback)(const void*, size_t);

override_callback override = NULL;

#if defined(_WIN32)
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
        // return value of zero means success
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
#endif

ssize_t write_hook(int fd,
                   const void* buffer,
                   size_t len) {
    // 1 = stdout, 2 = stderr
    if (fd == 1 || fd == 2) {
        // return value of zero means success
        if (override(buffer, len) == 0) {
            return len;
        }
    }
    return write(fd, buffer, len);
}

size_t fwrite_hook(const void *ptr,
                   size_t size,
		           size_t n,
                   FILE* s) {
    if (s == stdout || s == stderr) {
        if (override(ptr, size * n) == 0) {
            return n;
        }
    }
    return fwrite(ptr, size, n, s);
}

int fputs_hook(const char *t,
               FILE* s) {
    if (s == stdout || s == stderr) {
        size_t len = strlen(t);
        if (override(t, len) == 0) {
            return len;
        }
    }
    return fputs(t, s);
}

int puts_hook(const char *t) {
    size_t len = strlen(t);
    if (override(t, len) == 0) {
        override("\n", 1);
        return 1;
    }
    return puts(t);
}

int fputc_hook(int c,
               FILE* s) {
    if (s == stdout || s == stderr) {
        unsigned char b = c;
        if (override(&b, 1) == 0) {
            return 1;
        }
    }
    return fputc(c, s);
}

int putchar_hook(int c) {
    return fputc_hook(c, stdout);
}

int vfprintf_hook_impl(FILE* s,
                       const char* f,
                       va_list arg) {
    if (s == stdout || s == stderr) {
        // attempt with fixed-size buffer, using a copy of arg
        va_list arg_copy;
        va_copy(arg_copy, arg);
        char fixed_buffer[1024];
        char* s = fixed_buffer;
        int len = vsnprintf(fixed_buffer, sizeof(fixed_buffer), f, arg_copy);
        bool too_large = len + 1 > sizeof(fixed_buffer);
        if (too_large) {
            va_copy(arg_copy, arg);
            s = malloc(len + 1);
            vsnprintf(s, len + 1, f, arg_copy);
        }
        bool overrode = override(s, len) == 0;
        if (too_large) {
            free(s);
        }
        if (overrode) {
            return len;
        }
    }
    return -1;
}

int vfprintf_hook(FILE* s,
                  const char* f,
                  va_list arg) {
    int len = vfprintf_hook_impl(s, f, arg);
    return (len >= 0) ? len : vfprintf(s, f, arg);
}

int vprintf_hook(const char* f,
                 va_list arg) {
    return vfprintf_hook(stdout, f, arg);
}

int fprintf_hook(FILE* s,
                 const char* f,
                 ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

int printf_hook(const char* f,
                ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}

void perror_hook(const char *s) {
    printf_hook("%s: %s", s, strerror(errno));
}

#if defined(_WIN32)
int stdio_common_vfprintf_hook(unsigned __int64 options,
                               FILE* s,
                               char const* f,
                               _locale_t locale,
                               va_list arg) {
    int len = vfprintf_hook_impl(s, f, arg);
    return (len >= 0) ? len : __stdio_common_vfprintf(options, s, f, locale, arg);
}
#elif defined(__GLIBC__)
int vfprintf_chk_hook(FILE* s,
                      int flag,
                      const char* f,
                      va_list arg) {
    return vfprintf_hook(s, f, arg);
}

int vprintf_chk_hook(int flag,
                     const char* f,
                     va_list arg) {
    return vfprintf_chk_hook(stdout, flag, f, arg);
}

int fprintf_chk_hook(FILE* s,
                     int flag,
                     const char* f,
                     ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(s, flag, f, argptr);
    va_end(argptr);
    return n;
}

int printf_chk_hook(int flag,
                    const char* f,
                    ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(stdout, flag, f, argptr);
    va_end(argptr);
    return n;
}
#endif

typedef struct {
    const char* name;
    void* function;
} hook;

hook hooks[] = {
#if defined(_WIN32)
    { "WriteFile",                  write_file_hook },
    { "_write",                     write_hook },
#else
    { "write",                      write_hook },
#endif
    { "fputs",                      fputs_hook },
    { "puts",                       puts_hook },
    { "fputc",                      fputc_hook },
    { "putc",                       fputc_hook },
    { "putchar",                    putchar_hook },
    { "fwrite",                     fwrite_hook },
    { "vfprintf",                   vfprintf_hook },
    { "vprintf",                    vprintf_hook },
    { "fprintf",                    fprintf_hook },
    { "printf",                     printf_hook },
    { "perror",                     perror_hook },
#if defined(_WIN32)
    { "__stdio_common_vfprintf",    stdio_common_vfprintf_hook },
#elif defined(__GLIBC__)
    { "__vfprintf_chk",             vfprintf_chk_hook },
    { "__vprintf_chk",              vprintf_chk_hook },
    { "__fprintf_chk",              fprintf_chk_hook },
    { "__printf_chk",               printf_chk_hook },
#endif
};
#define HOOK_COUNT (sizeof(hooks) / sizeof(hook))

const void* find_hook(const char* name) {
    for (int i = 0; i < HOOK_COUNT; i++) {
        if (strcmp(name, hooks[i].name) == 0) {
            return hooks[i].function;
        }
    }
    return NULL;
}

void set_override(override_callback cb) {
    override = cb;
}
