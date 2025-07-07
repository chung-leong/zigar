#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

typedef enum {
    sc_write,
    sc_read,
} syscall_command;

typedef struct {
    uint32_t fd;
    const unsigned char *bytes;
    size_t len;
    uint32_t written;
} syscall_write;

typedef struct {
    uint32_t fd;
    unsigned char *bytes;
    size_t len;
    uint32_t read;
} syscall_read;

typedef union  {
    syscall_write write;
    syscall_read read;
} syscall_union;

typedef struct {
    syscall_command cmd;
    syscall_union u;
    size_t futex_handle;
} syscall_struct;

#define fd_min  0xfffff
