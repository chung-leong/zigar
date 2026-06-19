#ifndef PHP_CONFIG_H
#define PHP_CONFIG_H
#define _GNU_SOURCE
#include <string.h>
#include <dirent.h>
#include <utime.h>

// TODO: figure out what's required for MacOS
#define ZEND_API __attribute__ ((visibility("default")))
#define ZEND_DLEXPORT __attribute__ ((visibility("default")))

#define ZEND_MM_ALIGNMENT 8
#define ZEND_MM_ALIGNMENT_LOG2 3
#define ZEND_SIGNALS 1

#define SIZEOF_INT 4
#define SIZEOF_INTMAX_T 8
#define SIZEOF_LONG 8
#define SIZEOF_LONG_LONG 8
#define SIZEOF_OFF_T 8
#define SIZEOF_PTRDIFF_T 8
#define SIZEOF_SHORT 2
#define SIZEOF_SIZE_T 8

#define HAVE_DLFCN_H

// the use of _Atomic() causes structs to be demoted to opaque by Translate-C
// hence the need to keep the header from being included
#define ZEND_ATOMIC_H

typedef struct zend_atomic_bool_s {
	volatile _Bool value;
} zend_atomic_bool;

#endif 