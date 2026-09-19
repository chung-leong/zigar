#ifndef PHP_ROOT_H
#define PHP_ROOT_H

#define zend_gc_delref inline_zend_gc_delref
#define zval_addref_p inline_zval_addref_p
#include <php.h>
#include <zend_builtin_functions.h>
#include <zend_exceptions.h>
#include <zend_fibers.h>
#include <zend_interfaces.h>
#include <zend_closures.h>
#include <ext/standard/info.h>
#undef zend_gc_delref
#undef zval_addref_p

typedef struct {
    zval* ptr;
    size_t len;
    bool extra;
} arg_extra_info;

void set_zval_stream(zval* zv, const php_stream* strm);
php_stream_context* get_stream_context(const php_stream* strm);
zend_resource* get_stream_resource(const php_stream* strm);
const char* get_stream_path(const php_stream* strm);
const zval* get_stream_wrapper_data(const php_stream* strm);
const char* get_stream_mode(const php_stream* strm);
uint32_t get_stream_flags(const php_stream* strm);
const php_stream_ops* get_stream_handlers(const php_stream* strm);
php_stream_wrapper* get_stream_wrapper(const php_stream* strm);
void set_stream_wrapper(php_stream* strm, const php_stream_wrapper* wrapper);
void set_stream_no_close(php_stream* strm);
void get_argument_info(const zend_execute_data* ed, arg_extra_info* info);
uint32_t zend_gc_delref(zend_refcounted_h *p);
uint32_t zval_addref_p(zval* pz);

#endif // PHP_ROOT_H
