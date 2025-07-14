#define _GNU_SOURCE
#define __USE_POSIX
#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>
#include <stdarg.h>
#if defined(_WIN32)
    #include <windows.h>
    #include <io.h>
#else
    #include <unistd.h>
    #include <sys/stat.h>
    #include <sys/time.h>
    #include <dirent.h>
    #include <fcntl.h>
#endif

#define REDIRECTED_OBJECT_SIGNATURE     0x4A424F524147495A

typedef struct {
    uint64_t signature;
    int32_t  fd;
    uint16_t error;
    bool eof;
} redirected_FILE;

typedef struct {
    uint64_t signature;
    int32_t  fd;
    uint64_t cookie;
    uint32_t data_len;
    uint32_t data_next;    
    char buffer[4096];
    struct dirent entry;
} redirected_DIR;

typedef enum {
    cmd_access,
    cmd_advise,
    cmd_allocate,
    cmd_close,
    cmd_datasync,
    cmd_fcntl,
    cmd_fstat,
    cmd_futimes,
    cmd_getpos,
    cmd_mkdir,
    cmd_open,
    cmd_read,
    cmd_readdir,
    cmd_rmdir,
    cmd_seek,
    cmd_setpos,
    cmd_stat,
    cmd_sync,
    cmd_tell,
    cmd_unlink,
    cmd_utimes,
    cmd_write,
} syscall_command;

typedef enum {
    mask_mkdir = 1 << 0,
    mask_open = 1 << 1,
    mask_rmdir = 1 << 2,
    mask_set_times = 1 << 3,
    mask_stat = 1 << 4,
    mask_unlink = 1 << 5,
} syscall_mask;

typedef struct {
    int32_t dirfd;
    const char *path;
    uint32_t path_len;
    uint32_t mode;
} syscall_access;

typedef struct {
    int32_t dirfd;
    const char *path;
    uint32_t path_len;
    uint32_t oflags;
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
    fpos_t* pos;
} syscall_getpos;

typedef struct {
    int32_t fd;
    const fpos_t* pos;
} syscall_setpos;

typedef struct {
    int32_t fd;
    struct stat* stat;
} syscall_fstat;

typedef struct {
    int32_t dirfd;
    const char *path;
    uint32_t path_len;
    uint32_t flags;
    struct stat* stat;
} syscall_stat;

typedef struct {
    int32_t fd;
    struct timespec times[2];
} syscall_futimes;

typedef struct {
    int32_t dirfd;
    const char *path;
    uint32_t path_len;
    uint32_t flags;
    struct timespec times[2];
} syscall_utimes;

typedef struct {
    int32_t fd;
    uint8_t op;
    int64_t arg;
    uint32_t result;
} syscall_fcntl;

typedef struct {
    int32_t fd;
    uint64_t offset;
    uint64_t size;
    int32_t advice;
} syscall_advise;

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

typedef struct {
    redirected_DIR *dir;
} syscall_readdir;

typedef union  {
    syscall_access access;
    syscall_advise advise;
    syscall_allocate allocate;
    syscall_close close;
    syscall_datasync datasync;
    syscall_fcntl fcntl;
    syscall_fstat fstat;
    syscall_futimes futimes;
    syscall_getpos getpos;
    syscall_mkdir mkdir;
    syscall_open open;
    syscall_read read;
    syscall_readdir readdir;
    syscall_rmdir rmdir;
    syscall_seek seek;
    syscall_setpos setpos;
    syscall_stat stat;
    syscall_sync sync;
    syscall_tell tell;
    syscall_unlink unlink;
    syscall_utimes utimes;
    syscall_write write;
} syscall_union;

typedef struct {
    syscall_command cmd;
    syscall_union u;
    size_t futex_handle;
} syscall_struct;

