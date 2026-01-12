#ifndef PHP_ZIGAR_H
#define PHP_ZIGAR_H
#define PHP_ZIGAR_VERSION "1.0.0"

#include "php.h"

extern zend_result php_zigar_init(int type, int module_number);
extern zend_result php_zigar_shutdown(int type, int module_number);
extern void php_zigar_info(zend_module_entry* zend_module);
extern zend_function_entry php_zigar_functions[];

#endif // PHP_ZIGAR_H
