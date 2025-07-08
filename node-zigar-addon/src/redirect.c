#include <redirect.h>
#define fd_min  0xfffff
#define is_overriding(name)     (override && (override_mask & mask_##name))

typedef uint16_t (*override_callback)(syscall_struct*);
typedef void (*error_callback)(uint16_t);

override_callback override = NULL;

int override_mask = 0;

void set_errno(uint16_t err) {
    errno = err;
}

bool is_applicable_handle(size_t fd) {
    if (!override) return false;
    return fd >= fd_min || fd == 0 || fd == 1 || fd == 2;
}

int override_open(int dirfd, 
                  const char* path, 
                  int oflag, 
                  bool directory, 
                  bool follow_symlink,
                  error_callback error_cb) {
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
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }
    return call.u.open.fd;
}

int override_close(int fd,
                   error_callback error_cb) {
    syscall_struct call;
    call.cmd = fd_close;
    call.futex_handle = 0;
    call.u.close.fd = fd;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

ssize_t override_read(int fd,
                      char* buffer,
                      size_t len,
                      error_callback error_cb) {
    syscall_struct call;
    call.cmd = fd_read;
    call.futex_handle = 0;
    call.u.read.fd = fd;
    call.u.read.bytes = buffer;
    call.u.read.len = len;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return call.u.read.read;
}

ssize_t override_write(int fd,
                       const char* buffer,
                       size_t len,
                       error_callback error_cb) {
    syscall_struct call;
    call.cmd = fd_write;
    call.futex_handle = 0;
    call.u.write.fd = fd;
    call.u.write.bytes = buffer;
    call.u.write.len = len;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return call.u.write.written;
}

int override_vfprintf(int fd,
                      const char* f,
                      va_list arg,
                      error_callback error_cb) {
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
    int written = override_write(fd, buffer, len, error_cb);
    if (too_large) {
        free(buffer);
    }
    return written;
}

off64_t override_seek(int fd, 
                      off_t offset, 
                      int whence,
                      error_callback error_cb) {
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
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return call.u.seek.position;
}

int override_fstat(int fd, 
                   struct stat *buf,
                   error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = fd_fdstat_get;
    call.u.fstat.fd = fd;
    call.u.fstat.stat = buf;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

int override_stat(int dirfd,
                  const char* path, 
                  bool follow_symlink, 
                  struct stat *buf,
                  error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = fd_fdstat_get;
    call.u.stat.dirfd = dirfd;
    call.u.stat.path = path;
    call.u.stat.path_len = strlen(path);
    call.u.stat.follow_symlink = follow_symlink;
    call.u.stat.stat = buf;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

int override_allocate(int fd, 
                      uint64_t offset, 
                      uint64_t size,
                      error_callback error_cb) {
    syscall_struct call;
    call.cmd = fd_allocate;
    call.futex_handle = 0;
    call.u.allocate.fd = fd;
    call.u.allocate.offset = offset;
    call.u.allocate.offset = size;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

int override_sync(int fd,
                  error_callback error_cb) {
    syscall_struct call;
    call.cmd = fd_sync;
    call.futex_handle = 0;
    call.u.allocate.fd = fd;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

int override_datasync(int fd,
                      error_callback error_cb) {
    syscall_struct call;
    call.cmd = fd_sync;
    call.futex_handle = 0;
    call.u.allocate.fd = fd;
    int err = override(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
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
    if (is_overriding(open)) {
        return override_open(-1, path, oflag, false, true, set_errno);
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
    if (is_overriding(open)) {
        return override_open(-1, path, oflag, false, true, set_errno);
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
    if (is_overriding(open)) {
        return override_open(dirfd, path, oflag, false, true, set_errno);
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
    if (is_overriding(open)) {
        return override_open(dirfd, path, oflag, false, true, set_errno);
    }
    return (oflag | O_CREAT) ? openat64(dirfd, path, oflag, mode) : openat64(dirfd, path, oflag);
}

FILE* fopen_hook(const char *path, 
                 const char *mode) {
    if (is_overriding(open)) {
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
        int fd = override_open(-1, path, oflag, false, true, set_errno);
        if (fd == -1) return NULL;
        return fdopen(fd, mode);
    }
    return fopen(path, mode);
}

int close_hook(int fd) {
    if (is_applicable_handle(fd)) {
        return override_close(fd, set_errno);
    }
    return close(fd);
}

int fclose_hook(FILE *s) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        return override_close(fd, set_errno);
    }
    return fclose(s);
}

ssize_t read_hook(int fd, 
                  void* buffer, 
                  size_t len) {
    if (is_applicable_handle(fd)) {
        return override_read(fd, buffer, len, set_errno);
    }
    return read(fd, buffer, len);
}

size_t fread_hook(void* buffer, 
                  size_t size, 
                  size_t n,
                  FILE* s) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        ssize_t read = override_read(fd, buffer, size * n, set_errno);
        if (read == -1) return 0;
        if (read == size * n) return n;
        return read / size;
    }
    return fread(buffer, size, n, s);
}

ssize_t write_hook(int fd,
                   const void* buffer,
                   size_t len) {
    if (is_applicable_handle(fd)) {
        return override_write(fd, buffer, len, set_errno);
    }
    return write(fd, buffer, len);
}

size_t fwrite_hook(const void* buffer,
                   size_t size,
		           size_t n,
                   FILE* s) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        ssize_t written = override_write(fd, buffer, size * n, set_errno);
        if (written == -1) return 0;
        if (written == size * n) return n;
        return written / size;
    }
    return fwrite(buffer, size, n, s);
}

int fputs_hook(const char* t,
               FILE* s) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        size_t len = strlen(t);
        return override_write(fd, t, len, set_errno);
    }
    return fputs(t, s);
}

int puts_hook(const char* t) {
    size_t len = strlen(t);
    if (is_applicable_handle(1)) {
        ssize_t written = override_write(1, t, len, set_errno);
        if (written == -1) return -1;
        return override_write(1, "\n", 1, set_errno);
    }
}

int fputc_hook(int c,
               FILE* s) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        char b = c;
        return override_write(fd, &b, 1, set_errno);
    }
    return fputc(c, s);
}

int putchar_hook(int c) {
    return fputc_hook(c, stdout);
}

int vfprintf_hook(FILE* s,
                  const char* f,
                  va_list arg) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        return override_vfprintf(fd, f, arg, set_errno);
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
        return override_seek(fd, offset, whence, set_errno);
    }
    return lseek(fd, offset, whence);
}

off64_t lseek64_hook(int fd, 
                     off64_t offset, 
                     int whence) {
    if (is_applicable_handle(fd)) {
        return override_seek(fd, offset, whence, set_errno);
    }
    return lseek64(fd, offset, whence);
}

int fseek_hook(FILE* s, 
               long offset, 
               int whence) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        return override_seek(fd, offset, whence, set_errno);
    }
    return fseek(s, offset, whence);
}

int ftell_hook(FILE* s) {
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        return override_seek(fd, 0, SEEK_CUR, set_errno);
    }
    return ftell(s);
}

int fstat_hook(int fd, 
               struct stat *buf) {
    if (is_applicable_handle(fd)) {
        return override_fstat(fd, buf, set_errno);
    }
    return fstat(fd, buf);
}

int stat_hook(const char *path,
              struct stat *buf) {
    if (is_overriding(stat)) {
        return override_stat(-1, path, true, buf, set_errno);
    }
    return stat(path, buf);
}

int lstat_hook(const char *path,
               struct stat *buf) {
    if (is_overriding(stat)) {
        return override_stat(-1, path, false, buf, set_errno);
    }
    return stat(path, buf);
}

int fallocate(int fd, 
              int mode, 
              off_t offset, 
              off_t size) {

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
    int fd = fileno(s);
    if (is_applicable_handle(fd)) {
        return override_vfprintf(fd, f, arg, set_errno);
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

void set_override_mask(int mask, bool set) {
    if (set) {
        override_mask |= mask;
    } else {
        override_mask &= ~mask;
    }
}