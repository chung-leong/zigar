#ifndef PHP_CONFIG_H
#define PHP_CONFIG_H
#include "msvc_intrinsics.h"

#define ZEND_API __declspec(dllimport)
#define ZEND_DLEXPORT __declspec(dllexport)
#define ZEND_DLIMPORT __declspec(dllimport)

#define PHP_WIN32
#define ZEND_WIN32

#define _pid_t int
#define S_IFSOCK (S_IFMT + 1)

#endif 