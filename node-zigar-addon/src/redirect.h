#ifndef _REDIRECT_H_
#define _REDIRECT_H_
#include <stdlib.h>
#include <stdbool.h>

typedef unsigned int (*override_callback)(const void*, size_t);

void redirect_io_functions(void*, const char*, override_callback);

#endif