#include "../php/include/root.h"

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
