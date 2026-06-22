#define _GNU_SOURCE
#define _BSD_SOURCE

#include <node_api.h>

#ifdef _WIN32
    #include <windows.h>
    #include <imagehlp.h>
#else
    #include <dlfcn.h>
#endif

#ifdef linux
    #include <ucontext.h>
    #include <sys/prctl.h>
#endif
