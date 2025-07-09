#define _LARGEFILE64_SOURCE
#define __USE_POSIX
#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#if defined(_WIN32)
    #include <windows.h>
    #include <io.h>
#else
    #include <unistd.h>
    #include <sys/stat.h>
#endif

typedef enum {
    environ_get,
    environ_sizes_get,
    fd_advise,
    fd_allocate,
    fd_close,
    fd_datasync,
    fd_fdstat_get,
    fd_filestat_get,
    fd_filestat_set_times,
    fd_prestat_get,
    fd_prestat_dirname,
    fd_read,
    fd_readdir,
    fd_seek,
    fd_sync,
    fd_tell,
    fd_write,
    path_create_directory,
    path_filestat_get,
    path_filestat_set_times,
    path_open,
    path_remove_directory,
    path_unlink_file,
    proc_exit,
    random_get,
} syscall_command;

typedef enum {
    mask_mkdir = 1 << 0,
    mask_stat = 1 << 1,
    mask_set_times = 1 << 2,
    mask_open = 1 << 3,
    mask_rmdir = 1 << 4,
    mask_unlink = 1 << 5,
} syscall_mask;

typedef struct {
    int32_t dirfd;
    const char *path;
    uint32_t path_len;
    uint32_t oflag;
    bool directory;
    bool follow_symlink;
    int32_t fd;
} syscall_open;

typedef struct {
    int32_t fd;
} syscall_close, syscall_sync, syscall_datasync;

typedef struct {
    int32_t fd;
    char *bytes;
    uint32_t len;
    uint32_t read;
} syscall_read;

typedef struct {
    int32_t fd;
    const char *bytes;
    uint32_t len;
    uint32_t written;
} syscall_write;

typedef struct {
    int32_t fd;
    int64_t offset;
    uint32_t whence;
    uint64_t position;
} syscall_seek;

typedef struct {
    int32_t fd;
    uint64_t position;
} syscall_tell;

typedef struct {
    int32_t fd;
    struct stat* stat;
} syscall_fstat;

typedef struct {
    int32_t dirfd;
    const char *path;
    uint32_t path_len;
    bool follow_symlink;
    struct stat* stat;
} syscall_stat;

typedef struct {
    int32_t fd;
    uint64_t offset;
    uint64_t size;
} syscall_allocate;

typedef struct {
    int32_t dirfd;
    const char *path;
    uint32_t path_len;
} syscall_mkdir, syscall_rmdir, syscall_unlink;

typedef union  {
    syscall_open open;
    syscall_close close;
    syscall_read read;
    syscall_write write;
    syscall_seek seek;
    syscall_tell tell;
    syscall_fstat fstat;
    syscall_stat stat;
    syscall_allocate allocate;
    syscall_sync sync;
    syscall_datasync datasync;
    syscall_mkdir mkdir;
    syscall_rmdir rmdir;
    syscall_unlink unlink;
} syscall_union;

typedef struct {
    syscall_command cmd;
    syscall_union u;
    size_t futex_handle;
} syscall_struct;

