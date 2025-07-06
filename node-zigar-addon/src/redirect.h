#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

typedef enum {
    sc_write,
} syscall_command;

typedef struct {
    uint32_t fd;
    const unsigned char *bytes;
    size_t len;
    size_t written;
} syscall_write;

typedef union  {
    syscall_write write;
} syscall_union;

typedef struct {
    syscall_command cmd;
    syscall_union u;
    size_t futex_handle;
} syscall_struct;

#define fd_min  0xfffff
