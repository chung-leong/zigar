#ifndef _REDIRECT_H_
#define _REDIRECT_H_
#include <stdlib.h>
#include <stdbool.h>

typedef unsigned int (*override_callback)(const void*, size_t);

void patch_write_file(void*, const char*, override_callback);

#endif