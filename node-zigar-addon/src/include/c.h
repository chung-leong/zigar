#define _GNU_SOURCE
#define _BSD_SOURCE
#include <stdio.h>
#include <string.h>
#include <node_api.h>

#ifdef _WIN32
    #include <windows.h>
    #include <winternl.h>
    #include <imagehlp.h>
#else
    #include <dlfcn.h>
    #include <dirent.h>
    #include <errno.h>
#endif

#ifdef linux
    #include <ucontext.h>
    #include <sys/prctl.h>
#endif

#ifdef __OSX__
    #include <pthread.h>
    #include <libkern/OSCacheControl.h>
#endif
