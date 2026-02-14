#include "extension.h"
#ifdef HAVE_CONFIG_H
    #include "config.h"
#endif

PHP_MINIT_FUNCTION(php_zigar) {
    return php_zigar_mod_init(type, module_number);
}

PHP_MSHUTDOWN_FUNCTION(php_zigar) {
    return php_zigar_mod_shutdown(type, module_number);
}

PHP_RINIT_FUNCTION(php_zigar) {
    return php_zigar_req_init(type, module_number);
}

PHP_RSHUTDOWN_FUNCTION(php_zigar) {
    return php_zigar_req_shutdown(type, module_number);
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

/* php_stream_to_zval() cannot be imported into Zig due to the presence of bit fields in php_stream */
void set_zval_stream(zval* zv, php_stream* strm) {
    php_stream_to_zval(strm, zv);
}

php_stream_context* get_stream_context(php_stream* strm) {
    return PHP_STREAM_CONTEXT(strm);
}

void set_stream_no_close(php_stream* strm) {
    strm->flags |= PHP_STREAM_FLAG_NO_CLOSE;
}

typedef struct {
    zval* ptr;
    size_t len;
    bool extra;
} arg_info;

void get_argument_info(zend_execute_data* ed, arg_info* info) {
    info->ptr = ZEND_CALL_ARG(ed, 1);
    info->len = ZEND_CALL_NUM_ARGS(ed);
    info->extra = !!(ZEND_CALL_INFO(ed) & ZEND_CALL_HAS_EXTRA_NAMED_PARAMS);
}
