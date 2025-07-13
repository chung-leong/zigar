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

static bool redirect_open(int dirfd, const char* path, int oflags, bool directory, bool follow_symlink, int* fd, uint16_t* error_no) {
    syscall_struct call;
    call.cmd = cmd_open;
    call.futex_handle = 0;
    call.u.open.dirfd = check_dirfd(dirfd);
    call.u.open.path = path;
    call.u.open.path_len = strlen(path);
    call.u.open.oflags = oflags;
    call.u.open.directory = directory;
    call.u.open.follow_symlink = follow_symlink;
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

static bool redirect_stat(int dirfd, const char* path, bool follow_symlink, struct stat *buf, uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_stat;
    call.u.stat.dirfd = check_dirfd(dirfd);
    call.u.stat.path = path;
    call.u.stat.path_len = strlen(path);
    call.u.stat.follow_symlink = follow_symlink;
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
    memcpy(&call.u.futimes.tv, tv, sizeof(struct timeval) * 2);
    *error_no = redirect_syscall(&call);
}

static bool redirect_utimes(int dirfd, const char* path, bool follow_symlink, const struct timeval tv[2], uint16_t* error_no) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_utimes;
    call.u.utimes.dirfd = check_dirfd(dirfd);
    call.u.utimes.path = path;
    call.u.utimes.path_len = strlen(path);
    call.u.utimes.follow_symlink = follow_symlink;
    memcpy(&call.u.utimes.tv, tv, sizeof(struct timeval) * 2);
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
        if (redirect_open(-1, path, oflag, false, true, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? open(path, oflag, mode) : open(path, oflag);
}

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
        if (redirect_open(-1, path, oflag, false, true, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? open64(path, oflag, mode) : open64(path, oflag);
}

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
        if (redirect_open(dirfd, path, oflag, false, true, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? openat(dirfd, path, oflag, mode) : openat(dirfd, path, oflag);
}

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
        if (redirect_open(dirfd, path, oflag, false, true, &fd, &err)) {
            if (!err) {
                return fd;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return (oflag | O_CREAT) ? openat64(dirfd, path, oflag, mode) : openat64(dirfd, path, oflag);
}

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
        if (redirect_open(-1, path, oflags, false, true, &fd, &err)) {
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
    return fopen(path, mode);
}

static int close_hook(int fd) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_close(fd, &err);
        return (!err) ? 0 : -1;
    }
    return close(fd);
}

static int fclose_hook(FILE *s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        uint16_t err;
        redirect_close(file->fd, &err);
        free(file);
        return (!err) ? 0 : EOF;
    }
    return fclose(s);
}

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
    return read(fd, buffer, len);
}

static size_t fread_hook(void* buffer, size_t size, size_t n, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t read;
        uint16_t err;
        size_t count = size * n;
        redirect_read(file->fd, buffer, count, &read, &err);
        if (!err) {
            return (read == count) ? n : read / size;
        } else {
            errno = err;
            return -1;
        }
    }
    return fread(buffer, size, n, s);
}

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
    return write(fd, buffer, len);
}

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
            errno = err;
            return -1;
        }

    }
    return fwrite(buffer, size, n, s);
}

static int fputs_hook(const char* t, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        size_t len = strlen(t);
        ssize_t written;
        uint16_t err;
        redirect_write(file->fd, t, len, &written, &err);
        return (!err) ? written : -1;
    }
    return fputs(t, s);
}

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
    return puts(t);
}

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
            errno = err;
            return -1;
        }
    }
    return fputc(c, s);
}

static int putchar_hook(int c) {
    return fputc_hook(c, stdout);
}

static int vfprintf_hook(FILE* s, const char* f, va_list arg) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t written;
        uint16_t err;
        redirect_vfprintf(file->fd, f, arg, &written, &err);
        if (!err) {
            return written;
        } else {
            errno = err;
            return -1;
        }
    }
    return vfprintf(s, f, arg);
}

static int vprintf_hook(const char* f, va_list arg) {
    return vfprintf_hook(stdout, f, arg);
}

static int fprintf_hook(FILE* s, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(s, f, argptr);
    va_end(argptr);
    return n;
}

static int printf_hook(const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_hook(stdout, f, argptr);
    va_end(argptr);
    return n;
}

static void perror_hook(const char* s) {
    printf_hook("%s: %s", s, strerror(errno));
}

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
    return lseek(fd, offset, whence);
}

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
    return lseek64(fd, offset, whence);
}

static int fseek_hook(FILE* s, long offset, int whence) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        off64_t position;
        uint16_t err;
        redirect_seek(file->fd, offset, whence, &position, &err);
        if (!err) {
            return position;
        } else {
            errno = err;
            return -1;
        }
    }
    return fseek(s, offset, whence);
}

static int ftell_hook(FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        off64_t position;
        uint16_t err;
        redirect_seek(file->fd, 0, SEEK_CUR, &position, &err);
        if (!err) {
            return position;
        } else {
            errno = err;
            return -1;
        }
    }
    return ftell(s);
}

static int fgetpos_hook(FILE* s, fpos_t* pos) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        uint16_t err;
        redirect_getpos(file->fd, pos, &err);
        return (!err) ? 0 : -1;
    }
    return fsetpos(s, pos);
}

static int fsetpos_hook(FILE* s, const fpos_t* pos) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        uint16_t err;
        redirect_setpos(file->fd, pos, &err);
        return (!err) ? 0 : -1;
    }
    return fsetpos(s, pos);
}

static int fstat_hook(int fd, struct stat *buf) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_fstat(fd, buf, &err);
        return (!err) ? 0 : -1;
    }
    return fstat(fd, buf);
}

static int fxstat_hook(int ver, int fd, struct stat *buf) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_fstat(fd, buf, &err);
        return (!err) ? 0 : -1;
    }
    return fstat(fd, buf);
}

static int stat_hook(const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, true, buf, &err);
        return (!err) ? 0 : -1;
    }
    return stat(path, buf);
}

static int xstat_hook(int ver, const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, true, buf, &err);
        return (!err) ? 0 : -1;
    }
    return stat(path, buf);
}

static int lstat_hook(const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, false, buf, &err);
        return (!err) ? 0 : -1;
    }
    return stat(path, buf);
}

static int lxstat_hook(int ver, const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        uint16_t err;
        redirect_stat(-1, path, false, buf, &err);
        return (!err) ? 0 : -1;
    }
    return lstat(path, buf);
}

static int futimes_hook(int fd, const struct timeval tv[2]) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_futimes(fd, tv, &err);
        return (!err) ? 0 : -1;
    }
    return futimes(fd, tv);
}

static int utimes_hook(const char *path, const struct timeval tv[2]) {
    if (is_redirecting(mask_set_times)) {
        uint16_t err;
        redirect_utimes(-1, path, true, tv, &err);
        return (!err) ? 0 : -1;
    }
    return utimes(path, tv);
}

static int lutimes_hook(const char *path, const struct timeval tv[2]) {
    if (is_redirecting(mask_set_times)) {
        uint16_t err;
        redirect_utimes(-1, path, false, tv, &err);
        return (!err) ? 0 : -1;
    }
    return utimes(path, tv);
}

static int fcntl_hook(int fd, int op, int arg) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        uint32_t flags;
        redirect_fcntl(fd, op, arg, &flags, &err);
        return (!err) ? flags : -1;
    }
    return fcntl(fd, op, arg);
}

static int fsync_hook(int fd) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_sync(fd, &err);
        return (!err) ? 0 : -1;
    }
    return fsync(fd);
}

static int fdatasync_hook(int fd) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_datasync(fd, &err);
        return (!err) ? 0 : -1;
    }
    return fdatasync(fd);
}

static int posix_fadvise_hook(int fd, off_t offset, off_t size, int advice) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_advise(fd, offset, size, advice, &err);
        return (!err) ? 0 : -1;
    }
    return posix_fadvise(fd, offset, size, advice);
}

static int fallocate_hook(int fd, int mode, off_t offset, off_t size) {
    if (is_applicable_handle(fd)) {
        uint16_t err;
        redirect_allocate(fd, offset, size, &err);
        return (!err) ? 0 : -1;
    }
    return fallocate(fd, mode, offset, size);
}

static int mkdir_hook(const char *pathname, mode_t mode) {
    if (is_redirecting(mask_mkdir)) {
        uint16_t err;
        if (redirect_mkdir(-1, pathname, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return mkdir(pathname, mode);
}

static int mkdirat_hook(int dirfd, const char *pathname, mode_t mode) {
    if (is_redirecting(mask_mkdir)) {
        uint16_t err;
        if (redirect_mkdir(dirfd, pathname, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return mkdirat(dirfd, pathname, mode);
}

static int rmdir_hook(const char *pathname) {
    if (is_redirecting(mask_rmdir)) {
        uint16_t err;
        if (redirect_rmdir(-1, pathname, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return rmdir(pathname);
}

static int unlink_hook(const char *pathname) {
    if (is_redirecting(mask_unlink)) {
        uint16_t err;
        if (redirect_unlink(-1, pathname, &err)) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return unlink(pathname);
}

static int unlinkat_hook(int dirfd, const char *pathname, int flags) {
    if (is_redirecting(mask_unlink)) {
        uint16_t err;
        bool redirected = (flags & AT_REMOVEDIR) 
            ? redirect_rmdir(dirfd, pathname, &err)
            : redirect_unlink(dirfd, pathname, &err);
        if (redirected) {
            if (!err) {
                return 0;
            } else {
                errno = err;
                return -1;
            }
        }
    }
    return unlinkat(dirfd, pathname, flags);
}

static DIR* opendir_hook(const char *name) {
    if (is_redirecting(mask_open)) {
        uint16_t err;
        int fd;
        if (redirect_open(-1, name, 0, true, true, &fd, &err)) {
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
    return opendir(name);
}

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
    return readdir(d);
}

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
    return closedir(d);
}

#if defined(_WIN32)
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
    return WriteFile(handle, buffer, len, written, overlapped);
}

static int stdio_common_vfprintf_hook(unsigned __int64 options, FILE* s, char const* f, _locale_t locale, va_list arg) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return redirect_vfprintf(file->fd, f, arg, &err);
    }
    return __stdio_common_vfprintf(options, s, f, locale, arg);
}
#elif defined(__GLIBC__)
static int vfprintf_chk_hook(FILE* s, int flag, const char* f, va_list arg) {
    return vfprintf_hook(s, f, arg);
}

static int vprintf_chk_hook(int flag, const char* f, va_list arg) {
    return vfprintf_chk_hook(stdout, flag, f, arg);
}

static int fprintf_chk_hook(FILE* s, int flag, const char* f, ...) {
    va_list argptr;
    va_start(argptr, f);
    int n = vfprintf_chk_hook(s, flag, f, argptr);
    va_end(argptr);
    return n;
}

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
    { "__fxstat",                   fxstat_hook },
    { "stat",                       stat_hook },
    { "__xstat",                    xstat_hook },
    { "lstat",                      lstat_hook },
    { "__lxstat",                   lxstat_hook },
    { "futimes",                    futimes_hook },
    { "utimes",                     utimes_hook },
    { "lutimes",                    lutimes_hook },
    { "fcntl",                      fcntl_hook },
    { "posix_fadvise",              posix_fadvise_hook },
    { "fallocate",                  fallocate_hook },
    { "fsync",                      fsync_hook },
    { "fdatasync",                  fdatasync_hook },
    { "mkdir",                      mkdir_hook },
    { "mkdirat",                    mkdirat_hook },
    { "rmdir",                      rmdir_hook },
    { "unlink",                     unlink_hook },
    { "unlinkat",                   unlinkat_hook },
    { "opendir",                    opendir_hook },
    { "readdir",                    readdir_hook },
    { "closedir",                   closedir_hook },
#endif
    { "fopen",                      fopen_hook },
    { "fclose",                     fclose_hook },
    { "fread",                      fread_hook },
    { "fwrite",                     fwrite_hook },
    { "fseek",                      fseek_hook },
    { "ftell",                      ftell_hook },
    { "fgetpos",                    fgetpos_hook },
    { "fsetpos",                    fsetpos_hook },
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

const const void* find_hook(const char* name) {
    // printf("%s\n", name);
    for (int i = 0; i < HOOK_COUNT; i++) {
        if (strcmp(name, hooks[i].name) == 0) {
            return hooks[i].function;
        }
    }
    return NULL;
}
