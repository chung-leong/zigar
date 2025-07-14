#include "syscall-hooks.h"
#define fd_min  0xfffff

typedef void (*error_callback)(uint16_t);

uint16_t redirect_syscall(syscall_struct*);
bool is_redirecting(uint32_t);

static bool is_redirected_object(void* ptr) {
    if (!ptr) return false;
    uint64_t* sig_ptr = (uint64_t*) ptr;
    return *sig_ptr == REDIRECTED_OBJECT_SIGNATURE;
}

static bool is_applicable_handle(size_t fd) {
    return fd >= fd_min || fd == 0 || fd == 1 || fd == 2;
}

static int check_dirfd(int dirfd) {
    if (dirfd == -100) dirfd = -1;
    return dirfd;
}

static bool redirect_access(int dirfd, const char* path, int mode, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_access;
    call.futex_handle = 0;
    call.u.access.dirfd = check_dirfd(dirfd);
    call.u.access.path = path;
    call.u.access.path_len = strlen(path);
    call.u.access.mode = mode;
    uint16_t err = *error_no = redirect_syscall(&call);
    if (!err || err == EACCES) {
        return true;
    } else {
        return false;
    }
}

static bool redirect_open(int dirfd, const char* path, int oflags, int* fd, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_open;
    call.futex_handle = 0;
    call.u.open.dirfd = check_dirfd(dirfd);
    call.u.open.path = path;
    call.u.open.path_len = strlen(path);
    call.u.open.oflags = oflags;
    if (!(*error_no = redirect_syscall(&call))) {
        *fd = call.u.open.fd;
        return true;
    } else {
        return false;
    }
}

static void redirect_close(int fd, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_close;
    call.futex_handle = 0;
    call.u.close.fd = fd;
    *error_no = redirect_syscall(&call);
}

static void redirect_read(int fd, char* buffer, size_t len, ssize_t* read, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_read;
    call.futex_handle = 0;
    call.u.read.fd = fd;
    call.u.read.bytes = buffer;
    call.u.read.len = len;
    if (!(*error_no = redirect_syscall(&call))) {
        *read = call.u.read.read;
    }   
}

static void redirect_write(int fd, const char* buffer, size_t len, ssize_t* written, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_write;
    call.futex_handle = 0;
    call.u.write.fd = fd;
    call.u.write.bytes = buffer;
    call.u.write.len = len;
    if (!(*error_no = redirect_syscall(&call))) {
        *written = call.u.write.written;
    }   
}

static void redirect_vfprintf(int fd, const char* f, va_list arg, ssize_t* written, uint16_t* error_no) {
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
    redirect_write(fd, buffer, len, written, error_no);
    if (too_large) {
        free(buffer);
    }
}

#if defined(_STDC_WANT_LIB_EXT1_) 
static void redirect_vfprintf_s(int fd, const char* f, va_list arg, ssize_t* written, uint16_t* error_no) {
    va_list arg_copy;
    va_copy(arg_copy, arg);
    char fixed_buffer[1024];
    char* buffer = fixed_buffer;
    int len = vsnprintf_s(fixed_buffer, sizeof(fixed_buffer), f, arg_copy);
    bool too_large = len + 1 > sizeof(fixed_buffer);
    if (too_large) {
        va_copy(arg_copy, arg);
        buffer = malloc(len + 1);
        vsnprintf_s(buffer, len + 1, f, arg_copy);
    }
    redirect_write(fd, buffer, len, written, error_no);
    if (too_large) {
        free(buffer);
    }
}
#endif

static void redirect_seek(int fd, off_t offset, int whence, off64_t* pos, uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    if (offset == 0 && whence == SEEK_CUR) {
        call.cmd = cmd_tell;
        call.u.tell.fd = fd;
    } else {
        call.cmd = cmd_seek;
        call.u.seek.fd = fd;
        call.u.seek.offset = offset;
        call.u.seek.whence = whence;
    }
    if (!(*error_no = redirect_syscall(&call))) {
        *pos = (call.cmd == cmd_tell) ? call.u.tell.position : call.u.seek.position;
    }   
}

static void redirect_getpos(int fd, fpos_t* pos, uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_getpos;
    call.u.getpos.fd = fd;
    call.u.getpos.pos = pos;
    *error_no = redirect_syscall(&call);
}

static void redirect_setpos(int fd, const fpos_t* pos, uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_setpos;
    call.u.setpos.fd = fd;
    call.u.setpos.pos = pos;
    *error_no = redirect_syscall(&call);
}

static void redirect_fstat(int fd, struct stat *buf, uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_fstat;
    call.u.fstat.fd = fd;
    call.u.fstat.stat = buf;
    *error_no = redirect_syscall(&call);
}

static bool redirect_stat(int dirfd, const char* path, uint32_t flags, struct stat *buf, uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_stat;
    call.u.stat.dirfd = check_dirfd(dirfd);
    call.u.stat.path = path;
    call.u.stat.path_len = strlen(path);
    call.u.stat.flags = flags;
    call.u.stat.stat = buf;
    if(!(*error_no = redirect_syscall(&call))) {
        return true;
    } else {
        return false;
    }
}

static void redirect_futimes(int fd, const struct timeval tv[2], uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_futimes;
    call.u.futimes.fd = fd;
    memcpy(&call.u.futimes.times, tv, sizeof(struct timeval) * 2);
    *error_no = redirect_syscall(&call);
}

static bool redirect_utimes(int dirfd, const char* path, uint32_t flags, const struct timespec times[2], uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_utimes;
    call.u.utimes.dirfd = check_dirfd(dirfd);
    call.u.utimes.path = path;
    call.u.utimes.path_len = strlen(path);
    call.u.utimes.flags = flags;
    memcpy(&call.u.utimes.times, times, sizeof(struct timeval) * 2);
    if (!(*error_no = redirect_syscall(&call))) {
        return true;
    } else {
        return false;
    }   
}

static void redirect_fcntl(int fd, int op, int arg, uint32_t *result, uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_fcntl;
    call.u.fcntl.fd = fd;
    if (!(*error_no = redirect_syscall(&call))) {
        *result = call.u.fcntl.result;
    }
}

static void redirect_advise(int fd, uint64_t offset, uint64_t size, int advice, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_advise;
    call.futex_handle = 0;
    call.u.advise.fd = fd;
    call.u.advise.offset = offset;
    call.u.advise.size = size;
    call.u.advise.advice = advice;
    *error_no = redirect_syscall(&call);
}

static void redirect_allocate(int fd, uint64_t offset, uint64_t size, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_allocate;
    call.futex_handle = 0;
    call.u.allocate.fd = fd;
    call.u.allocate.offset = offset;
    call.u.allocate.size = size;
    *error_no = redirect_syscall(&call);
}

static void redirect_sync(int fd, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_sync;
    call.futex_handle = 0;
    call.u.sync.fd = fd;
    *error_no = redirect_syscall(&call);
}

static void redirect_datasync(int fd, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_datasync;
    call.futex_handle = 0;
    call.u.datasync.fd = fd;
    *error_no = redirect_syscall(&call);
}

static bool redirect_mkdir(int dirfd, const char* path, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_mkdir;
    call.futex_handle = 0;
    call.u.mkdir.dirfd = check_dirfd(dirfd);
    call.u.mkdir.path = path;
    call.u.mkdir.path_len = strlen(path);
    uint16_t err = *error_no = redirect_syscall(&call);
    if (!err || err == EEXIST) {
        return true;
    } else {
        return false;
    }
}

static bool redirect_rmdir(int dirfd, const char* path, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_rmdir;
    call.futex_handle = 0;
    call.u.rmdir.dirfd = check_dirfd(dirfd);
    call.u.rmdir.path = path;
    call.u.rmdir.path_len = strlen(path);
    if (!(*error_no = redirect_syscall(&call))) {
        return true;
    } else {
        return false;
    }
}

static bool redirect_unlink(int dirfd, const char* path, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_unlink;
    call.futex_handle = 0;
    call.u.unlink.dirfd = check_dirfd(dirfd);
    call.u.unlink.path = path;
    call.u.unlink.path_len = strlen(path);
    if (!(*error_no = redirect_syscall(&call))) {
        return true;
    } else {
        return false;
    }
}

static void redirect_readdir(redirected_DIR* d, struct dirent** entry, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_readdir;
    call.futex_handle = 0;
    call.u.readdir.dir = d;
    if (!(*error_no = redirect_syscall(&call))) {
        *entry = (d->data_len != 0) ? &d->entry : NULL;
    }
}

static int (*open_orig)(const char *path, int oflag, ...);
static int open_hook(const char *path, int oflag, ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    if (is_redirecting(mask_open)) {
        int fd;
        uint16_t err;
        if (redirect_open(-1, path, oflag, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? open_orig(path, oflag, mode) : open_orig(path, oflag);
}

static int (*open64_orig)(const char *path, int oflag, ...);
static int open64_hook(const char *path, int oflag, ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    if (is_redirecting(mask_open)) {
        int fd;
        uint16_t err;
        if (redirect_open(-1, path, oflag, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? open64_orig(path, oflag, mode) : open64_orig(path, oflag);
}

#ifdef __USE_ATFILE
static int (*openat_orig)(int dirfd, const char *path, int oflag, ...);
static int openat_hook(int dirfd, const char *path, int oflag, ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    if (is_redirecting(mask_open)) {
        int fd;
        uint16_t err;
        if (redirect_open(dirfd, path, oflag, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? openat_orig(dirfd, path, oflag, mode) : openat_orig(dirfd, path, oflag);
}
#endif

static int (*openat64_orig)(int dirfd, const char *path, int oflag, ...);
static int openat64_hook(int dirfd, const char *path, int oflag, ...) {
    mode_t mode = 0;
    if (oflag | O_CREAT) {
        va_list args;
        va_start(args, oflag);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    if (is_redirecting(mask_open)) {
        int fd;
        uint16_t err;
        if (redirect_open(dirfd, path, oflag, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? openat64_orig(dirfd, path, oflag, mode) : openat64_orig(dirfd, path, oflag);
}

static FILE* (*fopen_orig)(const char *path, const char *mode);
static FILE* fopen_hook(const char *path, const char *mode) {
    if (is_redirecting(mask_open)) {
        int oflags = 0;
        if (mode[0] == 'r') {
            oflags |= (mode[1] == '+') ? O_RDWR : O_RDONLY;
        } else if (mode[0] == 'w') {
            oflags |= (mode[1] == '+') ? O_RDWR : O_WRONLY;
            oflags |= O_TRUNC | O_CREAT;
        } else if (mode[0] == 'a') {
            oflags |= (mode[1] == '+') ? O_RDWR : O_WRONLY;
            oflags |= O_APPEND | O_CREAT;
        } else {
            return NULL;
        }
        int fd;
        uint16_t err;
        if (redirect_open(-1, path, oflags, &fd, &err)) {
            redirected_FILE* file;
            if (!err) {
                file = malloc(sizeof(redirected_FILE));
                if (!file) {
                    err = ENOMEM;
                }
            }
            if (!err) {
                file->signature = REDIRECTED_OBJECT_SIGNATURE;
                file->fd = fd;
                return (FILE*) file;
            } else {
                errno = err;
                return NULL;
            }
        }
    }
    return fopen_orig(path, mode);
}

static int (*close_orig)(int fd);
static int close_hook(int fd) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_close(fd, &err);
        if (err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return close_orig(fd);
}

static int (*fclose_orig)(FILE *s);
static int fclose_hook(FILE *s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        uint16_t err;
        redirect_close(file->fd, &err);
        free(file);
        if (err) {
            return 0;
        } else {
            errno = file->error = err;
            return EOF;
        }
    }
    return fclose_orig(s);
}

static ssize_t (*read_orig)(int fd, void* buffer, size_t len);
static ssize_t read_hook(int fd, void* buffer, size_t len) {
    if (is_applicable_handle(fd)) {
        ssize_t read;
        uint16_t err;
        redirect_read(fd, buffer, len, &read, &err);
        if (!err) {
            return read;
        } else {
            errno = err;
            return -1;
        }
    }
    return read_orig(fd, buffer, len);
}

static size_t (*fread_orig)(void* buffer, size_t size, size_t n, FILE* s);
static size_t fread_hook(void* buffer, size_t size, size_t n, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t read;
        uint16_t err;
        size_t count = size * n;
        redirect_read(file->fd, buffer, count, &read, &err);
        if (!err) {
            if (read == 0) {
                file->eof = true;
            }
            return (read == count) ? n : read / size;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return fread_orig(buffer, size, n, s);
}

static ssize_t (*write_orig)(int fd, const void* buffer, size_t len);
static ssize_t write_hook(int fd, const void* buffer, size_t len) {
    if (is_applicable_handle(fd)) {
        ssize_t read;
        uint16_t err;
        redirect_write(fd, buffer, len, &read, &err);
        if (!err) {
            return read;
        } else {
            errno = err;
            return -1;
        }
    }
    return write_orig(fd, buffer, len);
}

static size_t (*fwrite_orig)(const void* buffer, size_t size, size_t n, FILE* s);
static size_t fwrite_hook(const void* buffer, size_t size, size_t n, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t written;
        uint16_t err;
        size_t count = size * n;
        redirect_write(file->fd, buffer, count, &written, &err);
        if (!err) {
            return (written == count) ? n : written / size;
        } else {
            errno = file->error = err;
            return -1;
        }

    }
    return fwrite_orig(buffer, size, n, s);
}

static int (*fputs_orig)(const char* t, FILE* s);
static int fputs_hook(const char* t, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        size_t len = strlen(t);
        ssize_t written;
        uint16_t err;
        redirect_write(file->fd, t, len, &written, &err);
        if (!err) {
            return written;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return fputs_orig(t, s);
}

static int (*puts_orig)(const char* t);
static int puts_hook(const char* t) {
    if (is_applicable_handle(1)) {
        size_t len = strlen(t);
        ssize_t written;
        uint16_t err;
        redirect_write(1, t, len, &written, &err);
        if (!err) {
            ssize_t one;
            redirect_write(1, "\n", 1, &one, &err);
            written += 1;
        }
        if (!err) {
            return written;
        } else {
            errno = err;
            return -1;
        }
    }
    return puts_orig(t);
}

static int (*fputc_orig)(int c, FILE* s);
static int fputc_hook(int c, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        char b = c;
        ssize_t written;
        uint16_t err;
        redirect_write(file->fd, &b, 1, &written, &err);
        if (!err) {
            return written;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return fputc_orig(c, s);
}

static int (*putchar_orig)(int c);
static int putchar_hook(int c) {
    return fputc_hook(c, stdout);
}

static int (*vfprintf_orig)(FILE* s, const char* f, va_list arg);
static int vfprintf_hook(FILE* s, const char* f, va_list arg) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t written;
        uint16_t err;
        redirect_vfprintf(file->fd, f, arg, &written, &err);
        if (!err) {
            return written;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return vfprintf_orig(s, f, arg);
}

static int (*vprintf_orig)(const char* f, va_list arg);
static int vprintf_hook(const char* f, va_list arg) {
    return vfprintf_hook(stdout, f, arg);
}

static int (*fprintf_orig)(FILE* s, const char* f, ...);
static int fprintf_hook(FILE* s, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

static int (*printf_orig)(const char* f, ...);
static int printf_hook(const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}

#if defined(_STDC_WANT_LIB_EXT1_) 
static int (*vfprintf_s_orig)(FILE* s, const char* f, va_list arg)
static int vfprintf_s_hook(FILE* s, const char* f, va_list arg) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t written;
        uint16_t err;
        redirect_vfprintf_s(file->fd, f, arg, &written, &err);
        if (!err) {
            return written;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return vfprintf_s_orig(s, f, arg);
}

static int (*vprintf_s_orig)(const char* f, va_list arg);
static int vprintf_s_hook(const char* f, va_list arg) {
    return vfprintf_s_hook(stdout, f, arg);
}

static int (*fprintf_s_orig)(FILE* s, const char* f, ...)
static int fprintf_s_hook(FILE* s, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_s_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

static int (*printf_s_hook)(const char* f, ...);
static int printf_s_hook(const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_s_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}
#endif

static void (*perror_orig)(const char* s);
static void perror_hook(const char* s) {
    printf_hook("%s: %s", s, strerror(errno));
}

static int (*ferror_orig)(FILE* s);
static int ferror_hook(FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return file->error;
    }
    return ferror_orig(s);
}

static void (*clearerr_orig)(FILE* s);
static void clearerr_hook(FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        file->error = 0;
        return;
    }
    clearerr_orig(s);
}   

static off_t (*lseek_orig)(int fd, off_t offset, int whence);
static off_t lseek_hook(int fd, off_t offset, int whence) {
    if (is_applicable_handle(fd)) {
        off64_t position;
        uint16_t err;
        redirect_seek(fd, offset, whence, &position, &err);
        if (!err) {
            return position;
        } else {
            errno = err;
            return -1;
        }
    }
    return lseek_orig(fd, offset, whence);
}

static off64_t (*lseek64_orig)(int fd, off64_t offset, int whence);
static off64_t lseek64_hook(int fd, off64_t offset, int whence) {
    if (is_applicable_handle(fd)) {
        off64_t position;
        uint16_t err;
        redirect_seek(fd, offset, whence, &position, &err);
        if (!err) {
            return position;
        } else {
            errno = err;
            return -1;
        }
    }
    return lseek64_orig(fd, offset, whence);
}

static int (*fseek_orig)(FILE* s, long offset, int whence);
static int fseek_hook(FILE* s, long offset, int whence) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        off64_t pos;
        uint16_t err;
        redirect_seek(file->fd, offset, whence, &pos, &err);
        if (!err) {
            return pos;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return fseek_orig(s, offset, whence);
}

static int (*ftell_orig)(FILE* s);
static int ftell_hook(FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        off64_t pos;
        uint16_t err;
        redirect_seek(file->fd, 0, SEEK_CUR, &pos, &err);
        if (!err) {
            return pos;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return ftell_orig(s);
}

static int (*fgetpos_orig)(FILE* s, fpos_t* pos);
static int fgetpos_hook(FILE* s, fpos_t* pos) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        uint16_t err;
        redirect_getpos(file->fd, pos, &err);
        if (!err) {
            return 0;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return fgetpos_orig(s, pos);
}

static int (*fsetpos_orig)(FILE* s, const fpos_t* pos);
static int fsetpos_hook(FILE* s, const fpos_t* pos) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        uint16_t err;
        redirect_setpos(file->fd, pos, &err);
        if (!err) {
            file->eof = false;
            return 0;
        } else {
            errno = file->error = err;
            return -1;
        }
    }
    return fsetpos_orig(s, pos);
}

static void (*rewind_orig)(FILE* s);
static void rewind_hook(FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        uint16_t err;
        off64_t pos;
        redirect_seek(file->fd, 0, SEEK_SET, &pos, &err);
        if (!err) {
            file->error = 0;
            file->eof = false;
        } else {
            errno = file->error = err;
        }
        return;
    }
    rewind_orig(s);
}

static int (*feof_orig)(FILE* s);
static int feof_hook(FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return file->eof ? 1 : 0;
    }
    return feof_orig(s);
}

static int (*fstat_orig)(int fd, struct stat* buf);
static int fstat_hook(int fd, struct stat* buf) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_fstat(fd, buf, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return fstat_orig(fd, buf);
}

static int (*fxstat_orig)(int ver, int fd, struct stat* buf);
static int fxstat_hook(int ver, int fd, struct stat* buf) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_fstat(fd, buf, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return fxstat_orig(ver, fd, buf);
}

static int (*stat_orig)(const char* path, struct stat* buf);
static int stat_hook(const char *path, struct stat* buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, AT_SYMLINK_FOLLOW, buf, &err);
        if (!err) {
            return 0;
        }
    }
    return stat_orig(path, buf);
}

static int (*xstat_orig)(int ver, const char* path, struct stat* buf);
static int xstat_hook(int ver, const char* path, struct stat* buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, AT_SYMLINK_FOLLOW, buf, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return xstat_orig(ver, path, buf);
}

static int (*lstat_orig)(const char* path, struct stat* buf);
static int lstat_hook(const char *path, struct stat* buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, AT_SYMLINK_NOFOLLOW, buf, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return lstat_orig(path, buf);
}

static int (*lxstat_orig)(int ver, const char* path, struct stat* buf);
static int lxstat_hook(int ver, const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, AT_SYMLINK_NOFOLLOW, buf, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return lxstat_orig(ver, path, buf);
}

#ifdef __USE_ATFILE
static int (*fstatat_orig)(int dirfd, const char* path, struct stat* buf, int flags);
static int fstatat_hook(int dirfd, const char* path, struct stat* buf, int flags) {
    if (is_applicable_handle(dirfd) || (dirfd == -100 && is_redirecting(mask_stat))) {
        uint16_t err;
        redirect_stat(-1, path, flags, buf, &err);
        if (!err) {
            return 0;
        } else if (dirfd != -100) {
            errno = err;
            return -1;
        }
    }
    return fstatat_orig(dirfd, path, buf, flags);
}

static int (*fxstatat_orig)(int ver, int dirfd, const char* path, struct stat* buf, int flags);
static int fxstatat_hook(int ver, int dirfd, const char *path, struct stat *buf, int flags) {
    if (is_applicable_handle(dirfd) || (dirfd == -100 && is_redirecting(mask_stat))) {
        uint16_t err;
        redirect_stat(dirfd, path, flags, buf, &err);
        if (!err) {
            return 0;
        } else if (dirfd != -100) {
            errno = err;
            return -1;
        }
    }
    return fxstatat_orig(ver, dirfd, path, buf, flags);
}
#endif

static int (*futimes_orig)(int fd, const struct timeval tv[2]);
static int futimes_hook(int fd, const struct timeval tv[2]) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        struct timespec times[2] = {
            { tv[0].tv_sec, tv[0].tv_usec * 1000 },
            { tv[1].tv_sec, tv[1].tv_usec * 1000 },
        };
        redirect_futimes(fd, times, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return futimes_orig(fd, tv);
}

static int (*utimes_orig)(const char* path, const struct timeval tv[2]);
static int utimes_hook(const char* path, const struct timeval tv[2]) {
    if (is_redirecting(mask_set_times)) {
        uint16_t err;
        struct timespec times[2] = {
            { tv[0].tv_sec, tv[0].tv_usec * 1000 },
            { tv[1].tv_sec, tv[1].tv_usec * 1000 },
        };
        redirect_utimes(-1, path, AT_SYMLINK_FOLLOW, times, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return utimes_orig(path, tv);
}

static int (*lutimes_orig)(const char* path, const struct timeval tv[2]);
static int lutimes_hook(const char* path, const struct timeval tv[2]) {
    if (is_redirecting(mask_set_times)) {
        uint16_t err;
        struct timespec times[2] = {
            { tv[0].tv_sec, tv[0].tv_usec * 1000 },
            { tv[1].tv_sec, tv[1].tv_usec * 1000 },
        };
        redirect_utimes(-1, path, AT_SYMLINK_NOFOLLOW, times, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return lutimes_orig(path, tv);
}

static int (*futimens_orig)(int fd, const struct timespec times[2]);
static int futimens_hook(int fd, const struct timespec times[2]) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_futimes(fd, times, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return futimens_orig(fd, times);
}

#ifdef __USE_ATFILE
static int (*untimensat_orig)(int dirfd, const char* path, const struct timespec times[2], int flags);
static int untimensat_hook(int dirfd, const char* path, const struct timespec times[2], int flags) {
    if (is_redirecting(mask_set_times)) {
        uint16_t err;
        redirect_utimes(-1, path, AT_SYMLINK_NOFOLLOW, times, &err);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
}
#endif

static int (*access_orig)(const char* path, int mode);
static int access_hook(const char* path, int mode) {
    if (is_redirecting(mask_open)) {
        uint16_t err;
        if (redirect_access(-1, path, mode, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return access_orig(path, mode);
}

#ifdef __USE_ATFILE
static int (*faccessat_orig)(int dirfd, const char* path, int type, int mode);
static int faccessat_hook(int dirfd, const char* path, int type, int mode) {
    if (is_redirecting(mask_open)) {
        uint16_t err;
        if (redirect_access(dirfd, path, mode, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return faccessat_orig(dirfd, path, type, mode);
}
#endif
 
static int (*fcntl_orig)(int fd, int op, int arg);
static int fcntl_hook(int fd, int op, int arg) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        uint32_t flags;
        redirect_fcntl(fd, op, arg, &flags, &err);
        return (!err) ? flags : -1;
    }
    return fcntl_orig(fd, op, arg);
}

static int (*fsync_orig)(int fd);
static int fsync_hook(int fd) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_sync(fd, &err);
        return (!err) ? 0 : -1;
    }
    return fsync_orig(fd);
}

static int (*fdatasync_orig)(int fd);
static int fdatasync_hook(int fd) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_datasync(fd, &err);
        return (!err) ? 0 : -1;
    }
    return fdatasync_orig(fd);
}

static int (*posix_fadvise_orig)(int fd, off_t offset, off_t size, int advice);
static int posix_fadvise_hook(int fd, off_t offset, off_t size, int advice) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_advise(fd, offset, size, advice, &err);
        return (!err) ? 0 : -1;
    }
    return posix_fadvise_orig(fd, offset, size, advice);
}

static int (*fallocate_orig)(int fd, int mode, off_t offset, off_t size);
static int fallocate_hook(int fd, int mode, off_t offset, off_t size) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_allocate(fd, offset, size, &err);
        return (!err) ? 0 : -1;
    }
    return fallocate_orig(fd, mode, offset, size);
}

static int (*mkdir_orig)(const char *path, mode_t mode);
static int mkdir_hook(const char *path, mode_t mode) {
    if (is_redirecting(mask_mkdir)) {
        uint16_t err;
        if (redirect_mkdir(-1, path, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return mkdir_orig(path, mode);
}

#ifdef __USE_ATFILE
static int (*mkdirat_orig)(int dirfd, const char *path, mode_t mode);
static int mkdirat_hook(int dirfd, const char *path, mode_t mode) {
    if (is_redirecting(mask_mkdir)) {
        uint16_t err;
        if (redirect_mkdir(dirfd, path, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return mkdirat_orig(dirfd, path, mode);
}
#endif

static int (*rmdir_orig)(const char *path);
static int rmdir_hook(const char *path) {
    if (is_redirecting(mask_rmdir)) {
        uint16_t err;
        if (redirect_rmdir(-1, path, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return rmdir_orig(path);
}

static int (*unlink_orig)(const char *path);
static int unlink_hook(const char *path) {
    if (is_redirecting(mask_unlink)) {
        uint16_t err;
        if (redirect_unlink(-1, path, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return unlink_orig(path);
}

#ifdef __USE_ATFILE
static int (*unlinkat_orig)(int dirfd, const char *path, int flags);
static int unlinkat_hook(int dirfd, const char *path, int flags) {
    if (is_redirecting(mask_unlink)) {
        uint16_t err;
        bool redirected = (flags & AT_REMOVEDIR) 
            ? redirect_rmdir(dirfd, path, &err)
            : redirect_unlink(dirfd, path, &err);
        if (redirected) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return unlinkat_orig(dirfd, path, flags);
}
#endif

static DIR* (*opendir_orig)(const char *name);
static DIR* opendir_hook(const char *name) {
    if (is_redirecting(mask_open)) {
        uint16_t err;
        int fd;
        if (redirect_open(-1, name, O_DIRECTORY, &fd, &err)) {
            redirected_DIR* dir;
            if (!err) {
                dir = malloc(sizeof(redirected_DIR));
                if (!dir) {
                    err = ENOMEM;
                }
            }
            if (!err) {
                dir->signature = REDIRECTED_OBJECT_SIGNATURE;
                dir->fd = fd;
                dir->cookie = 0;
                dir->data_len = 0;
                dir->data_next = 0;
                memset(&dir->entry, 0, sizeof(struct dirent));
                return dir;
            } else {
                return NULL;
            }
        }
    }
    return opendir_orig(name);
}

static struct dirent* (*readdir_orig)(DIR *d);
static struct dirent* readdir_hook(DIR *d) {
    if (is_redirected_object(d)) {
        redirected_DIR* dir = (redirected_DIR*) d;
        struct dirent* entry;
        uint16_t err;
        redirect_readdir(d, &entry, &err);
        if (!err) {
            return entry;
        } else {
            errno = err;
            return NULL;
        }
    }
    return readdir_orig(d);
}

static int (*closedir_orig)(DIR* d);
static int closedir_hook(DIR* d) {
    if (is_redirected_object(d)) {
        redirected_DIR* dir = (redirected_DIR*) d;
        uint16_t err;
        redirect_close(dir->fd, &err);
        free(dir);
        if (!err) {
            return 0;
        } else {
            errno = err;
            return -1;
        }
    }
    return closedir_orig(d);
}

#if defined(_WIN32)
static BOOL WINAPI (*write_file_orig)(HANDLE handle, LPCVOID buffer, DWORD len, LPDWORD written, LPOVERLAPPED overlapped)
static BOOL WINAPI write_file_hook(HANDLE handle, LPCVOID buffer, DWORD len, LPDWORD written, LPOVERLAPPED overlapped) {
    // return value of zero means success
    if (is_applicable_handle(handle)) {
        if (redirect_write(handle, buffer, len)) {
            *written = len;
            if (overlapped) {
                SetEvent(overlapped->hEvent);
            }
            return TRUE;
        }
    }
    return write_file_orig(handle, buffer, len, written, overlapped);
}

static int (*stdio_common_vfprintf_orig)(unsigned __int64 options, FILE* s, char const* f, _locale_t locale, va_list arg);
static int stdio_common_vfprintf_hook(unsigned __int64 options, FILE* s, char const* f, _locale_t locale, va_list arg) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return redirect_vfprintf(file->fd, f, arg, &err);
    }
    return stdio_common_vfprintf_orig(options, s, f, locale, arg);
}
#elif defined(__GLIBC__)
static int (*vfprintf_chk_orig)(FILE* s, int flag, const char* f, va_list arg);
static int vfprintf_chk_hook(FILE* s, int flag, const char* f, va_list arg) {
    return vfprintf_hook(s, f, arg);
}

static int (*vprintf_chk_orig)(int flag, const char* f, va_list arg);
static int vprintf_chk_hook(int flag, const char* f, va_list arg) {
    return vfprintf_chk_hook(stdout, flag, f, arg);
}

static int (*fprintf_chk_orig)(FILE* s, int flag, const char* f, ...);
static int fprintf_chk_hook(FILE* s, int flag, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(s, flag, f, argptr);
    va_end(argptr);
    return n;
}

static int (*printf_chk_orig)(int flag, const char* f, ...);
static int printf_chk_hook(int flag, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(stdout, flag, f, argptr);
    va_end(argptr);
    return n;
}
#endif

typedef struct {
    const char* name;
    void* handler;
    void** original;
} hook;

hook hooks[] = {
#if defined(_WIN32)
    // { "WriteFile",                  write_file_hook },
    // { "_write",                     write_hook },
#else
    { "open",                       open_hook,                      (void**) &open_orig },
    { "open64",                     open64_hook,                    (void**) &open64_orig },
    { "openat64",                   openat64_hook,                  (void**) &openat64_orig },
    { "close",                      close_hook,                     (void**) &close_orig },
    { "read",                       read_hook,                      (void**) &read_orig },
    { "write",                      write_hook,                     (void**) &write_orig },
    { "lseek",                      lseek_hook,                     (void**) &lseek_orig },
    { "lseek64",                    lseek64_hook,                   (void**) &lseek64_orig },
    { "fstat",                      fstat_hook,                     (void**) &fstat_orig },
    { "__fxstat",                   fxstat_hook,                    (void**) &fxstat_orig },
    { "stat",                       stat_hook,                      (void**) &stat_orig },
    { "__xstat",                    xstat_hook,                     (void**) &xstat_orig },
    { "lstat",                      lstat_hook,                     (void**) &lstat_orig },
    { "__lxstat",                   lxstat_hook,                    (void**) &lxstat_orig },
    { "access",                     access_hook,                    (void**) &access_orig },
    { "futimes",                    futimes_hook,                   (void**) &futimes_orig },
    { "utimes",                     utimes_hook,                    (void**) &utimes_orig },
    { "lutimes",                    lutimes_hook,                   (void**) &lutimes_orig },
    { "futimens",                   futimens_hook,                  (void**) &futimens_orig },
    { "fcntl",                      fcntl_hook,                     (void**) &fcntl_orig },
    { "posix_fadvise",              posix_fadvise_hook,             (void**) &posix_fadvise_orig },
    { "fallocate",                  fallocate_hook,                 (void**) &fallocate_orig },
    { "fsync",                      fsync_hook,                     (void**) &fsync_orig },
    { "fdatasync",                  fdatasync_hook,                 (void**) &fdatasync_orig },
    { "mkdir",                      mkdir_hook,                     (void**) &mkdir_orig },
    { "rmdir",                      rmdir_hook,                     (void**) &rmdir_orig },
    { "unlink",                     unlink_hook,                    (void**) &unlink_orig },
    { "opendir",                    opendir_hook,                   (void**) &opendir_orig },
    { "readdir",                    readdir_hook,                   (void**) &readdir_orig },
    { "closedir",                   closedir_hook,                  (void**) &closedir_orig },
#endif
#ifdef __USE_ATFILE
    { "openat",                     openat_hook,                    (void**) &openat_orig },
    { "fstatat",                    fstatat_hook,                   (void**) &fstatat_orig },
    { "__fxstatat",                 fxstatat_hook,                  (void**) &fxstatat_orig },
    { "faccessat",                  faccessat_hook,                 (void**) &faccessat_orig },
    { "mkdirat",                    mkdirat_hook,                   (void**) &mkdirat_orig },
    { "unlinkat",                   unlinkat_hook,                  (void**) &unlinkat_orig },
    { "utimensat",                  untimensat_hook,                (void**) &untimensat_orig },
#endif
    { "fopen",                      fopen_hook,                     (void**) &fopen_orig },
    { "fclose",                     fclose_hook,                    (void**) &fclose_orig },
    { "fread",                      fread_hook,                     (void**) &fread_orig },
    { "fwrite",                     fwrite_hook,                    (void**) &fwrite_orig },
    { "fseek",                      fseek_hook,                     (void**) &fseek_orig },
    { "ftell",                      ftell_hook,                     (void**) &ftell_orig },
    { "fgetpos",                    fgetpos_hook,                   (void**) &fgetpos_orig },
    { "fsetpos",                    fsetpos_hook,                   (void**) &fsetpos_orig },
    { "rewind",                     rewind_hook,                    (void**) &rewind_orig },
    { "feof",                       feof_hook,                      (void**) &feof_orig },
    { "fputs",                      fputs_hook,                     (void**) &fputs_orig },
    { "puts",                       puts_hook,                      (void**) &puts_orig },
    { "fputc",                      fputc_hook,                     (void**) &fputc_orig },
    { "putc",                       fputc_hook,                     (void**) &fputc_orig },
    { "putchar",                    putchar_hook,                   (void**) &putchar_orig },
    { "vfprintf",                   vfprintf_hook,                  (void**) &vfprintf_orig },
    { "vprintf",                    vprintf_hook,                   (void**) &vprintf_orig },
    { "fprintf",                    fprintf_hook,                   (void**) &fprintf_orig },
    { "printf",                     printf_hook,                    (void**) &printf_orig },
    { "perror",                     perror_hook,                    (void**) &perror_orig },
    { "ferror",                     ferror_hook,                    (void**) &ferror_orig },
    { "clearerr",                   clearerr_hook,                  (void**) &clearerr_orig },
#if defined(_STDC_WANT_LIB_EXT1_) 
    { "vfprintf_s",                 vfprintf_s_hook,                (void**) &vfprintf_s_orig },
    { "vprintf_s",                  vprintf_s_hook,                 (void**) &vprintf_s_orig },
    { "fprintf_s",                  fprintf_s_hook,                 (void**) &fprintf_s_orig },
    { "printf_s",                   printf_s_hook,                  (void**) &printf_s_orig },
#endif
#if defined(_WIN32)
    // { "__stdio_common_vfprintf",    stdio_common_vfprintf_hook },
#elif defined(__GLIBC__)
    { "__vfprintf_chk",             vfprintf_chk_hook,              (void**) &vfprintf_chk_orig },
    { "__vprintf_chk",              vprintf_chk_hook,               (void**) &vprintf_chk_orig },
    { "__fprintf_chk",              fprintf_chk_hook,               (void**) &fprintf_chk_orig },
    { "__printf_chk",               printf_chk_hook,                (void**) &printf_chk_orig },
#endif
};
#define HOOK_COUNT (sizeof(hooks) / sizeof(hook))

__attribute__ ((visibility ("hidden")))
const const hook* find_hook(const char* name) {
    for (int i = 0; i < HOOK_COUNT; i++) {
        if (strcmp(name, hooks[i].name) == 0) {
            return &hooks[i];
        }
    }
    // printf("%s\n", name);
    return NULL;
}
