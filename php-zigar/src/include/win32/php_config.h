#ifndef PHP_CONFIG_H
#define PHP_CONFIG_H
#include <intrin.h>

#define ZEND_API __declspec(dllimport)
#define ZEND_DLEXPORT __declspec(dllexport)
#define ZEND_DLIMPORT __declspec(dllimport)

#define PHP_WIN32
#define ZEND_WIN32

#define _pid_t int
#define _PID_T_

char _InterlockedExchange8(
   char volatile * Target,
   char Value
);
char _InterlockedExchange8_acq(
   char volatile * Target,
   char Value
);
char _InterlockedExchange8_nf(
   char volatile * Target,
   char Value
);
char _InterlockedExchange8_rel(
   char volatile * Target,
   char Value
);

#endif 