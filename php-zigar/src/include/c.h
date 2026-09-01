#include <php.h>
#include <zend_builtin_functions.h>
#include <zend_exceptions.h>
#include <zend_fibers.h>
#include <zend_interfaces.h>
#include <zend_closures.h>
#include <ext/standard/info.h>

#ifdef linux
    #include <ucontext.h>
    #include <sys/prctl.h>
#endif

#ifdef ZEND_WIN32
    #include <imagehlp.h>
#else
    // undefine these to avoid problems when optimize = ReleaseSafe
    #undef __va_arg_pack_len
    #undef __USE_GNU
    #include <fcntl.h>
#endif
