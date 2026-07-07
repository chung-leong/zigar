#include <stdio.h>
#include <string.h>

#ifdef _WIN32
    #include <windows.h>
    #include <winternl.h>
#else
    #include <dirent.h>
    #include <errno.h>
#endif

#ifdef __APPLE__
    #include <pthread.h>
    #include <libkern/OSCacheControl.h>
#endif
