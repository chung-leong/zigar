#define _GNU_SOURCE
#define _BSD_SOURCE
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>

#ifdef _WIN32
    #include <windows.h>
    #include <winternl.h>
    #include <winnt.h>
    #include <ntstatus.h>
#else
    #include <dirent.h>
    #include <errno.h>
    #include <dlfcn.h>
#endif

#ifdef __APPLE__
    #include <pthread.h>
    #include <libkern/OSCacheControl.h>
#endif
