// this file gets translated by translate-c; symbols will then be available in @import("c")

#include "../php/include/root.h"    // contains includes needed by zig-php-ext

// place any additional includes and function prototypes here

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
