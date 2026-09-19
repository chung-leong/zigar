#include "php/root.c"

extern zend_result php_zigar_mod_init(int type, int module_number);
extern zend_result php_zigar_mod_shutdown(int type, int module_number);
extern zend_result php_zigar_req_init(int type, int module_number);
extern zend_result php_zigar_req_shutdown(int type, int module_number);
extern void php_zigar_info(zend_module_entry* zend_module);
extern zend_function_entry php_zigar_functions[];

PHP_MINIT_FUNCTION(zigar) {
    return php_zigar_mod_init(type, module_number);
}

PHP_MSHUTDOWN_FUNCTION(zigar) {
    return php_zigar_mod_shutdown(type, module_number);
}

PHP_RINIT_FUNCTION(zigar) {
    return php_zigar_req_init(type, module_number);
}

PHP_RSHUTDOWN_FUNCTION(zigar) {
    return php_zigar_req_shutdown(type, module_number);
}

PHP_MINFO_FUNCTION(zigar) {
    php_zigar_info(zend_module);
}

zend_module_entry zigar_module_entry = {
    STANDARD_MODULE_HEADER,
    "zigar",
    php_zigar_functions,
    PHP_MINIT(zigar),
    PHP_MSHUTDOWN(zigar),
    PHP_RINIT(zigar),
    PHP_RSHUTDOWN(zigar),
    PHP_MINFO(zigar),
    "0.16.0",
	STANDARD_MODULE_PROPERTIES,
};

ZEND_GET_MODULE(zigar)
