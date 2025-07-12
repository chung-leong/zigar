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

static void set_errno(uint16_t err) {
    errno = err;
}

static bool is_applicable_handle(size_t fd) {
    return fd >= fd_min || fd == 0 || fd == 1 || fd == 2;
}

static int check_dirfd(int dirfd) {
    if (dirfd == -100) dirfd = -1;
    return dirfd;
}

static int redirect_open(int dirfd, const char* path, int oflags, bool directory, bool follow_symlink, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_open;
    call.futex_handle = 0;
    call.u.open.dirfd = check_dirfd(dirfd);
    call.u.open.path = path;
    call.u.open.path_len = strlen(path);
    call.u.open.oflags = oflags;
    call.u.open.directory = directory;
    call.u.open.follow_symlink = follow_symlink;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }
    return call.u.open.fd;
}

static int redirect_close(int fd, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_close;
    call.futex_handle = 0;
    call.u.close.fd = fd;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static ssize_t redirect_read(int fd, char* buffer, size_t len, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_read;
    call.futex_handle = 0;
    call.u.read.fd = fd;
    call.u.read.bytes = buffer;
    call.u.read.len = len;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return call.u.read.read;
}

static ssize_t redirect_write(int fd, const char* buffer, size_t len, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_write;
    call.futex_handle = 0;
    call.u.write.fd = fd;
    call.u.write.bytes = buffer;
    call.u.write.len = len;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return call.u.write.written;
}

static int redirect_vfprintf(int fd, const char* f, va_list arg, error_callback error_cb) {
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
    int written = redirect_write(fd, buffer, len, error_cb);
    if (too_large) {
        free(buffer);
    }
    return written;
}

static off64_t redirect_seek(int fd, off_t offset, int whence, error_callback error_cb) {
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
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return (call.cmd == cmd_tell) ? call.u.tell.position : call.u.seek.position;
}

static int redirect_getpos(int fd, fpos_t *pos, error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_getpos;
    call.u.getpos.fd = fd;
    call.u.getpos.pos = pos;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_setpos(int fd, const fpos_t *pos, error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_setpos;
    call.u.setpos.fd = fd;
    call.u.setpos.pos = pos;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_fstat(int fd, struct stat *buf, error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_fstat;
    call.u.fstat.fd = fd;
    call.u.fstat.stat = buf;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_stat(int dirfd, const char* path, bool follow_symlink, struct stat *buf, error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_stat;
    call.u.stat.dirfd = check_dirfd(dirfd);
    call.u.stat.path = path;
    call.u.stat.path_len = strlen(path);
    call.u.stat.follow_symlink = follow_symlink;
    call.u.stat.stat = buf;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_futimes(int fd, const struct timeval tv[2], error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_futimes;
    call.u.futimes.fd = fd;
    memcpy(&call.u.futimes.tv, tv, sizeof(struct timeval) * 2);
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_utimes(int dirfd, const char* path, bool follow_symlink, const struct timeval tv[2], error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_utimes;
    call.u.utimes.dirfd = check_dirfd(dirfd);
    call.u.utimes.path = path;
    call.u.utimes.path_len = strlen(path);
    call.u.utimes.follow_symlink = follow_symlink;
    memcpy(&call.u.utimes.tv, tv, sizeof(struct timeval) * 2);
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_fcntl(int fd, int op, int arg, error_callback error_cb) {
    syscall_struct call;
    call.futex_handle = 0;
    call.cmd = cmd_fcntl;
    call.u.fcntl.fd = fd;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return call.u.fcntl.result;
}

static int redirect_advise(int fd, uint64_t offset, uint64_t size, int advice, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_advise;
    call.futex_handle = 0;
    call.u.advise.fd = fd;
    call.u.advise.offset = offset;
    call.u.advise.size = size;
    call.u.advise.advice = advice;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_allocate(int fd, uint64_t offset, uint64_t size, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_allocate;
    call.futex_handle = 0;
    call.u.allocate.fd = fd;
    call.u.allocate.offset = offset;
    call.u.allocate.size = size;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_sync(int fd, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_sync;
    call.futex_handle = 0;
    call.u.sync.fd = fd;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_datasync(int fd, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_datasync;
    call.futex_handle = 0;
    call.u.datasync.fd = fd;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }   
    return 0;
}

static int redirect_mkdir(int dirfd, const char* path, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_mkdir;
    call.futex_handle = 0;
    call.u.mkdir.dirfd = check_dirfd(dirfd);
    call.u.mkdir.path = path;
    call.u.mkdir.path_len = strlen(path);
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }
    return 0;
}

static int redirect_rmdir(int dirfd, const char* path, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_rmdir;
    call.futex_handle = 0;
    call.u.rmdir.dirfd = check_dirfd(dirfd);
    call.u.rmdir.path = path;
    call.u.rmdir.path_len = strlen(path);
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }
    return 0;
}

static int redirect_unlink(int dirfd, const char* path, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_unlink;
    call.futex_handle = 0;
    call.u.unlink.dirfd = check_dirfd(dirfd);
    call.u.unlink.path = path;
    call.u.unlink.path_len = strlen(path);
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return -1;
    }
    return 0;
}

static struct dirent* redirect_readdir(redirected_DIR* d, error_callback error_cb) {
    syscall_struct call;
    call.cmd = cmd_readdir;
    call.futex_handle = 0;
    call.u.readdir.dir = d;
    int err = redirect_syscall(&call);
    if (err) {
        error_cb(err);
        return NULL;
    }
    return (d->data_len != 0) ? &d->entry : NULL;
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
        int result = redirect_open(-1, path, oflag, false, true, set_errno);
        if (!result || result == EEXIST) {
            return result;
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
        return redirect_open(-1, path, oflag, false, true, set_errno);
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
        return redirect_open(dirfd, path, oflag, false, true, set_errno);
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
        return redirect_open(dirfd, path, oflag, false, true, set_errno);
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
        int fd = redirect_open(-1, path, oflags, false, true, set_errno);
        if (fd == -1) return NULL;
        redirected_FILE* file = malloc(sizeof(redirected_FILE));
        if (file) {
            file->signature = REDIRECTED_OBJECT_SIGNATURE;
            file->fd = fd;
        }
        return (FILE*) file;
    }
    return fopen(path, mode);
}

static int close_hook(int fd) {
    if (is_applicable_handle(fd)) {
        return redirect_close(fd, set_errno);
    }
    return close(fd);
}

static int fclose_hook(FILE *s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        int fd = file->fd;
        free(file);
        return redirect_close(fd, set_errno);
    }
    return fclose(s);
}

static ssize_t read_hook(int fd, void* buffer, size_t len) {
    if (is_applicable_handle(fd)) {
        return redirect_read(fd, buffer, len, set_errno);
    }
    return read(fd, buffer, len);
}

static size_t fread_hook(void* buffer, size_t size, size_t n, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t read = redirect_read(file->fd, buffer, size * n, set_errno);
        if (read == -1) return 0;
        if (read == size * n) return n;
        return read / size;
    }
    return fread(buffer, size, n, s);
}

static ssize_t write_hook(int fd, const void* buffer, size_t len) {
    if (is_applicable_handle(fd)) {
        return redirect_write(fd, buffer, len, set_errno);
    }
    return write(fd, buffer, len);
}

static size_t fwrite_hook(const void* buffer, size_t size, size_t n, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        ssize_t written = redirect_write(file->fd, buffer, size * n, set_errno);
        if (written == -1) return 0;
        if (written == size * n) return n;
        return written / size;
    }
    return fwrite(buffer, size, n, s);
}

static int fputs_hook(const char* t, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        size_t len = strlen(t);
        return redirect_write(file->fd, t, len, set_errno);
    }
    return fputs(t, s);
}

static int puts_hook(const char* t) {
    size_t len = strlen(t);
    if (is_applicable_handle(1)) {
        ssize_t written = redirect_write(1, t, len, set_errno);
        if (written == -1) return -1;
        return redirect_write(1, "\n", 1, set_errno);
    }
    return puts(t);
}

static int fputc_hook(int c, FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        char b = c;
        return redirect_write(file->fd, &b, 1, set_errno);
    }
    return fputc(c, s);
}

static int putchar_hook(int c) {
    return fputc_hook(c, stdout);
}

static int vfprintf_hook(FILE* s, const char* f, va_list arg) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return redirect_vfprintf(file->fd, f, arg, set_errno);
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
        return redirect_seek(fd, offset, whence, set_errno);
    }
    return lseek(fd, offset, whence);
}

static off64_t lseek64_hook(int fd, off64_t offset, int whence) {
    if (is_applicable_handle(fd)) {
        return redirect_seek(fd, offset, whence, set_errno);
    }
    return lseek64(fd, offset, whence);
}

static int fseek_hook(FILE* s, long offset, int whence) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return redirect_seek(file->fd, offset, whence, set_errno);
    }
    return fseek(s, offset, whence);
}

static int ftell_hook(FILE* s) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return redirect_seek(file->fd, 0, SEEK_CUR, set_errno);
    }
    return ftell(s);
}

static int fgetpos_hook(FILE* s, const fpos_t* pos) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return redirect_getpos(file->fd, pos, set_errno);
    }
    return fsetpos(s, pos);
}

static int fsetpos_hook(FILE* s, const fpos_t* pos) {
    if (is_redirected_object(s)) {
        redirected_FILE* file = (redirected_FILE*) s;
        return redirect_setpos(file->fd, pos, set_errno);
    }
    return fsetpos(s, pos);
}

static int fstat_hook(int fd, struct stat *buf) {
    if (is_applicable_handle(fd)) {
        return redirect_fstat(fd, buf, set_errno);
    }
    return fstat(fd, buf);
}

static int fxstat_hook(int ver, int fd, struct stat *buf) {
    if (is_applicable_handle(fd)) {
        return redirect_fstat(fd, buf, set_errno);
    }
    return fstat(fd, buf);
}

static int stat_hook(const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        return redirect_stat(-1, path, true, buf, set_errno);
    }
    return stat(path, buf);
}

static int xstat_hook(int ver, const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        return redirect_stat(-1, path, true, buf, set_errno);
    }
    return stat(path, buf);
}

static int lstat_hook(const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        return redirect_stat(-1, path, false, buf, set_errno);
    }
    return stat(path, buf);
}

static int lxstat_hook(int ver, const char *path, struct stat *buf) {
    if (is_redirecting(mask_stat)) {
        return redirect_stat(-1, path, false, buf, set_errno);
    }
    return lstat(path, buf);
}

static int futimes_hook(int fd, const struct timeval tv[2]) {
    if (is_applicable_handle(fd)) {
        return redirect_futimes(fd, tv, set_errno);
    }
    return futimes(fd, tv);
}

static int utimes_hook(const char *path, const struct timeval tv[2]) {
    if (is_redirecting(mask_set_times)) {
        return redirect_utimes(-1, path, true, tv, set_errno);
    }
    return utimes(path, tv);
}

static int lutimes_hook(const char *path, const struct timeval tv[2]) {
    if (is_redirecting(mask_set_times)) {
        return redirect_utimes(-1, path, false, tv, set_errno);
    }
    return utimes(path, tv);
}

static int fcntl_hook(int fd, int op, int arg) {
    if (is_applicable_handle(fd)) {
        return redirect_fcntl(fd, op, arg, set_errno);
    }
    return fcntl(fd, op, arg);
}

static int fsync_hook(int fd) {
    if (is_applicable_handle(fd)) {
        return redirect_sync(fd, set_errno);
    }
    return fsync(fd);
}

static int fdatasync_hook(int fd) {
    if (is_applicable_handle(fd)) {
        return redirect_datasync(fd, set_errno);
    }
    return fdatasync(fd);
}

static int posix_fadvise_hook(int fd, off_t offset, off_t size, int advice) {
    if (is_applicable_handle(fd)) {
        return redirect_advise(fd, offset, size, advice, set_errno);
    }
    return posix_fadvise(fd, offset, size, advice);
}

static int fallocate_hook(int fd, int mode, off_t offset, off_t size) {
    if (is_applicable_handle(fd)) {
        return redirect_allocate(fd, offset, size, set_errno);
    }
    return fallocate(fd, mode, offset, size);
}

static int mkdir_hook(const char *pathname, mode_t mode) {
    if (is_redirecting(mask_mkdir)) {
        int result = redirect_mkdir(-1, pathname, set_errno);
        if (!result || result == EEXIST) {
            return result;
        }
    }
    return mkdir(pathname, mode);
}

static int mkdirat_hook(int dirfd, const char *pathname, mode_t mode) {
    if (is_redirecting(mask_mkdir)) {
        int result = redirect_mkdir(dirfd, pathname, set_errno);
        if (!result || result == EEXIST) {
            return result;
        }
    }
    return mkdirat(dirfd, pathname, mode);
}

static int rmdir_hook(const char *pathname) {
    if (is_redirecting(mask_rmdir)) {
        int result = redirect_rmdir(-1, pathname, set_errno);
        if (!result) {
            return result;
        }
    }
    return rmdir(pathname);
}

static int unlink_hook(const char *pathname) {
    if (is_redirecting(mask_unlink)) {
        int result = redirect_unlink(-1, pathname, set_errno);
        if (!result) {
            return result;
        }
    }
    return unlink(pathname);
}

static int unlinkat_hook(int dirfd, const char *pathname, int flags) {
    if (is_redirecting(mask_unlink)) {
        int result = (flags & AT_REMOVEDIR) 
            ? redirect_rmdir(dirfd, pathname, set_errno)
            : redirect_unlink(dirfd, pathname, set_errno);
        if (!result) {
            return result;
        }
    }
    return unlinkat(dirfd, pathname, flags);
}

static DIR* opendir_hook(const char *name) {
    if (is_redirecting(mask_open)) {
        int fd = redirect_open(-1, name, 0, true, true, set_errno);
        if (fd != -1) {
            redirected_DIR* dir = malloc(sizeof(redirected_DIR));
            dir->signature = REDIRECTED_OBJECT_SIGNATURE;
            dir->fd = fd;
            dir->cookie = 0;
            dir->data_len = 0;
            dir->data_next = 0;
            memset(&dir->entry, 0, sizeof(struct dirent));
            return dir;
        }
    }
    return opendir(name);
}

static struct dirent* readdir_hook(DIR *d) {
    if (is_redirected_object(d)) {
        redirected_DIR* dir = (redirected_DIR*) d;
        return redirect_readdir(d, set_errno);
    }
    return readdir(d);
}

static int closedir_hook(DIR* d) {
    if (is_redirected_object(d)) {
        redirected_DIR* dir = (redirected_DIR*) d;
        int fd = dir->fd;
        free(dir);
        return redirect_close(fd, set_errno);
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
        return redirect_vfprintf(file->fd, f, arg, set_errno);
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
