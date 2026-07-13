#include <php.h>
#include <zend_builtin_functions.h>
#include <zend_exceptions.h>
#include <zend_fibers.h>
#include <zend_interfaces.h>
#include <zend_closures.h>
#include <ext/standard/info.h>

#ifdef ZEND_WIN32
    #include <imagehlp.h>
#endif

#ifdef linux
    #include <ucontext.h>
    #include <sys/prctl.h>
    #include <fcntl.h>
#endif
