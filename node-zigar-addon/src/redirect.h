#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

typedef enum {
    invalid_command = -1,
    environ_get,
    environ_sizes_get,
    fd_advise,
    fd_allocate,
    fd_close,
    fd_datasync,
    fd_fdstat_get,
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

typedef struct {
    int32_t dirfd;
    const unsigned char *path;
    uint32_t path_len;
    uint32_t oflag;
    uint32_t mode;
    bool directory;
    bool follow_symlink;
    int32_t fd;
} syscall_open;

typedef struct {
    int32_t fd;
} syscall_close;

typedef struct {
    int32_t fd;
    unsigned char *bytes;
    uint32_t len;
    uint32_t read;
} syscall_read;

typedef struct {
    int32_t fd;
    const unsigned char *bytes;
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

typedef union  {
    syscall_open open;
    syscall_close close;
    syscall_read read;
    syscall_write write;
    syscall_seek seek;
    syscall_tell tell;
} syscall_union;

typedef struct {
    syscall_command cmd;
    syscall_union u;
    size_t futex_handle;
} syscall_struct;

