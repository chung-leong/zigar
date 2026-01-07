#include "extension.h"
#ifdef HAVE_CONFIG_H
    #include "config.h"
#endif
#include "ext/standard/info.h"

PHP_MINIT_FUNCTION(php_zigar) {
    return SUCCESS;
}

PHP_MSHUTDOWN_FUNCTION(php_zigar) {
    return SUCCESS;
}

PHP_RINIT_FUNCTION(php_zigar) {
    return SUCCESS;
}

PHP_RSHUTDOWN_FUNCTION(php_zigar) {
    return SUCCESS;
}

PHP_MINFO_FUNCTION(php_zigar) {
    php_info_print_table_start();
    php_info_print_table_header(2, "PHP Zigar", "enabled");
    php_info_print_table_end();
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
