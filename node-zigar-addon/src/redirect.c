#include <redirect.h>

typedef uint16_t (*override_callback)(syscall_struct*);

override_callback override = NULL;

#define fd_min  0xfffff

bool is_applicable_handle(size_t fd) {
    return fd >= fd_min || fd == 0 || fd == 1 || fd == 2;
}

bool override_open(int dirfd, 
                   const char* path, 
                   int oflag, 
                   bool directory, 
                   bool follow_symlink,
                   int* fd_ptr) {
    if (dirfd == -100) {
        dirfd = -1;
    }
    syscall_struct call;
    call.cmd = path_open;
    call.futex_handle = 0;
    call.u.open.dirfd = dirfd;
    call.u.open.path = path;
    call.u.open.path_len = strlen(path);
    call.u.open.oflag = oflag;
    call.u.open.directory = directory;
    call.u.open.follow_symlink = follow_symlink;
    if (!override || override(&call) != 0) return false;
    *fd_ptr = call.u.open.fd;
    return true;
}

bool override_close(int fd) {
    syscall_struct call;
    call.cmd = fd_close;
    call.futex_handle = 0;
    call.u.close.fd = fd;
    if (!override || override(&call) != 0) return false;
    return true;
}

bool override_read(int fd,
                   char* buffer,
                   size_t len,
                   uint32_t* read_ptr) {
    syscall_struct call;
    call.cmd = fd_read;
    call.futex_handle = 0;
    call.u.read.fd = fd;
    call.u.read.bytes = buffer;
    call.u.read.len = len;
    if (!override || override(&call) != 0) return false;
    *read_ptr = call.u.read.read;
    return true;
}

bool override_write(int fd,
                    const char* buffer,
                    size_t len) {
    syscall_struct call;
    call.cmd = fd_write;
    call.futex_handle = 0;
    call.u.write.fd = fd;
    call.u.write.bytes = buffer;
    call.u.write.len = len;
    // return value of zero means success
    if (!override || override(&call) != 0) return false;
    return true;
}

bool override_vfprintf(FILE* s,
                       const char* f,
                       va_list arg,
                       int *written) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
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
        bool overrode = override_write(fd, buffer, len) == 0;
        if (too_large) {
            free(s);
        }
        if (overrode) {
            *written = len;
            return true;
        }
    }
    return false;
}

bool override_seek(int fd, 
                   off_t offset, 
                   int whence,
                   uint64_t* pos_ptr) {
    syscall_struct call;
    call.futex_handle = 0;
    if (offset == 0 && whence == SEEK_CUR) {
        call.cmd = fd_tell;
        call.u.tell.fd = fd;
    } else {
        call.cmd = fd_seek;
        call.u.seek.fd = fd;
        call.u.seek.offset = offset;
        call.u.seek.whence = whence;
    }
    if (!override || override(&call) != 0) return false;
    *pos_ptr = call.u.seek.position;
    return true;
}

bool override_fstat(int fd, 
                    struct stat *buf) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = fd_fdstat_get;
    call.u.fstat.fd = fd;
    call.u.fstat.stat = buf;
    if (!override || override(&call) != 0) return false;
    return true;
}

bool override_stat(int dirfd,
                   const char* path, 
                   bool follow_symlink, 
                   struct stat *buf) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = fd_fdstat_get;
    call.u.stat.dirfd = dirfd;
    call.u.stat.path = path;
    call.u.stat.path_len = strlen(path);
    call.u.stat.follow_symlink = follow_symlink;
    call.u.stat.stat = buf;
    if (!override || override(&call) != 0) return false;
    return true;
}

int open_hook(const char *path, 
              int oflag, 
              ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    int fd;
    if (override_open(-1, path, oflag, false, true, &fd)) {
        return fd;
    }
    return (oflag | O_CREAT) ? open(path, oflag, mode) : open(path, oflag);
}

int open64_hook(const char *path, 
                int oflag, 
                ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    int fd;
    if (override_open(-1, path, oflag, false, true, &fd)) {
        return fd;
    }
    return (oflag | O_CREAT) ? open64(path, oflag, mode) : open64(path, oflag);
}

int openat_hook(int dirfd, 
                const char *path, 
                int oflag,
                ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    int fd;
    if (override_open(dirfd, path, oflag, false, true, &fd)) {
        return fd;
    }
    return (oflag | O_CREAT) ? openat(dirfd, path, oflag, mode) : openat(dirfd, path, oflag);
}

int openat64_hook(int dirfd, 
                  const char *path, 
                  int oflag,
                  ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    int fd;
    if (override_open(dirfd, path, oflag, false, true, &fd)) {
        return fd;
    }
    return (oflag | O_CREAT) ? openat64(dirfd, path, oflag, mode) : openat64(dirfd, path, oflag);
}

FILE* fopen_hook(const char *path, 
                 const char *mode) {
    int oflag = 0;
    if (mode[0] == 'r') {
        oflag |= (mode[1] == '+') ? O_RDWR : O_RDONLY;
    } else if (mode[0] == 'w') {
        oflag |= (mode[1] == '+') ? O_RDWR : O_WRONLY;
        oflag |= O_TRUNC | O_CREAT;
    } else if (mode[0] == 'a') {
        oflag |= (mode[1] == '+') ? O_RDWR : O_WRONLY;
        oflag |= O_APPEND | O_CREAT;
    } else {
        return NULL;
    }
    int fd;
    if (override_open(-1, path, oflag, false, true, &fd)) {        
        return fdopen(fd, mode);
    }
    return fopen(path, mode);
}

int close_hook(int fd) {
    if (is_applicable_handle(fd)) {
        if (override_close(fd)) {
            return 0;
        }
    }
    return close(fd);
}

int fclose_hook(FILE *s) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        if (override_close(fd)) {
            return 0;
        }
    }
    return fclose(s);
}

ssize_t read_hook(int fd, 
                  void* buffer, 
                  size_t len) {
    if (is_applicable_handle(fd)) {
        uint32_t read;
        if (override_read(fd, buffer, len, &read)) {
            return read;
        }
    }
    return read(fd, buffer, len);
}

size_t fread_hook(void* buffer, 
                  size_t size, 
                  size_t n,
                  FILE* s) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        uint32_t read;
        if (override_read(fd, buffer, size * n, &read)) {
            return read / size;
        }
    }
    return fread(buffer, size, n, s);
}

ssize_t write_hook(int fd,
                   const void* buffer,
                   size_t len) {
    if (is_applicable_handle(fd)) {
        if (override_write(fd, buffer, len)) {
            return len;
        }
    }
    return write(fd, buffer, len);
}

size_t fwrite_hook(const void* buffer,
                   size_t size,
		           size_t n,
                   FILE* s) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        if (override_write(fd, buffer, size * n)) {
            return n;
        }
    }
    return fwrite(buffer, size, n, s);
}

int fputs_hook(const char* t,
               FILE* s) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        size_t len = strlen(t);
        if (override_write(fd, t, len)) {
            return len;
        }
    }
    return fputs(t, s);
}

int puts_hook(const char* t) {
    size_t len = strlen(t);
    if (override_write(1, t, len)) {
        override_write(1, "\n", 1);
        return 1;
    }
    return puts(t);
}

int fputc_hook(int c,
               FILE* s) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        char b = c;
        if (override_write(fd, &b, 1)) {
            return 1;
        }
    }
    return fputc(c, s);
}

int putchar_hook(int c) {
    return fputc_hook(c, stdout);
}

int vfprintf_hook(FILE* s,
                  const char* f,
                  va_list arg) {
    int len;
    if (override_vfprintf(s, f, arg, &len)) {
        return len;
    }
    return vfprintf(s, f, arg);
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

void perror_hook(const char* s) {
    printf_hook("%s: %s", s, strerror(errno));
}

off_t lseek_hook(int fd, 
                 off_t offset, 
                 int whence) {
    if (is_applicable_handle(fd)) {
        uint64_t pos;
        if (override_seek(fd, offset, whence, &pos)) {
            return pos;
        }
    }
    return lseek(fd, offset, whence);
}

off64_t lseek64_hook(int fd, 
                     off64_t offset, 
                     int whence) {
    if (is_applicable_handle(fd)) {
        uint64_t pos;
        if (override_seek(fd, offset, whence, &pos)) {
            return pos;
        }
    }
    return lseek64(fd, offset, whence);
}

int fseek_hook(FILE* s, 
               long offset, 
               int whence) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        uint64_t pos;
        if (override_seek(fd, offset, whence, &pos)) {
            return pos;
        }
    }
    return fseek(s, offset, whence);
}

int ftell_hook(FILE* s) {
    const int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        uint64_t pos;
        if (override_seek(fd, 0, SEEK_CUR, &pos)) {
            return pos;
        }
    }
    return ftell(s);
}

int fstat_hook(int fd, 
               struct stat *buf) {
    printf("fstat_hook %d\n", fd);
    if (is_applicable_handle(fd)) {
        if (override_fstat(fd, buf)) {
            return 0;
        }
    }
    return fstat(fd, buf);
}

int stat_hook(const char *path,
              struct stat *buf) {
    if (override_stat(-1, path, true, buf)) {
        return 0;
    }
    return stat(path, buf);
}

int lstat_hook(const char *path,
               struct stat *buf) {
    if (override_stat(-1, path, false, buf)) {
        return 0;
    }
    return stat(path, buf);
}

#if defined(_WIN32)
BOOL WINAPI write_file_hook(HANDLE handle,
                            LPCVOID buffer,
                            DWORD len,
                            LPDWORD written,
                            LPOVERLAPPED overlapped) {
    // return value of zero means success
    if (is_applicable_handle(handle)) {
        if (override_write(handle, buffer, len)) {
            *written = len;
            if (overlapped) {
                SetEvent(overlapped->hEvent);
            }
            return TRUE;
        }
    }
    return WriteFile(handle, buffer, len, written, overlapped);
}

int stdio_common_vfprintf_hook(unsigned __int64 options,
                               FILE* s,
                               char const* f,
                               _locale_t locale,
                               va_list arg) {
    int len;
    if (override_vfprintf(s, f, arg, &len)) {
        return len;
    }
    return __stdio_common_vfprintf(options, s, f, locale, arg);
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
    { "open",                       open_hook },
    { "open64",                     open64_hook },
    { "openat",                     openat_hook },
    { "openat64",                   openat64_hook },
    { "close",                      close_hook },
    { "read",                       read_hook },
    { "write",                      write_hook },
    { "lseek",                      lseek_hook },
    { "lseek64",                    lseek64_hook },
    { "fstat",                      fstat_hook },
    { "stat",                       stat_hook },
    { "lstat",                      lstat_hook },
#endif
    { "fopen",                      fopen_hook },
    { "fclose",                     fclose_hook },
    { "fread",                      fread_hook },
    { "fwrite",                     fwrite_hook },
    { "fseek",                      fseek_hook },
    { "ftell",                      ftell_hook },
    { "fputs",                      fputs_hook },
    { "puts",                       puts_hook },
    { "fputc",                      fputc_hook },
    { "putc",                       fputc_hook },
    { "putchar",                    putchar_hook },
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
