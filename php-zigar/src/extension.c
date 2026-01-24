#include "extension.h"
#ifdef HAVE_CONFIG_H
    #include "config.h"
#endif

PHP_MINIT_FUNCTION(php_zigar) {
    return php_zigar_init(type, module_number);
}

PHP_MSHUTDOWN_FUNCTION(php_zigar) {
    return php_zigar_shutdown(type, module_number);
}

PHP_RINIT_FUNCTION(php_zigar) {
    return SUCCESS;
}

PHP_RSHUTDOWN_FUNCTION(php_zigar) {
    return SUCCESS;
}

PHP_MINFO_FUNCTION(php_zigar) {
    php_zigar_info(zend_module);
}

zend_module_entry php_zigar_module_entry = {
    STANDARD_MODULE_HEADER,
    "php_zigar",
    php_zigar_functions,
    PHP_MINIT(php_zigar),
    PHP_MSHUTDOWN(php_zigar),
    PHP_RINIT(php_zigar),
    PHP_RSHUTDOWN(php_zigar),
    PHP_MINFO(php_zigar),
    PHP_ZIGAR_VERSION,
    STANDARD_MODULE_PROPERTIES
};

ZEND_GET_MODULE(php_zigar)
