#define _GNU_SOURCE
#define __wasilibc_unmodified_upstream
#include <stdio.h>

#ifdef _WIN32
    #include <windows.h>
    #include <utime.h>
#else
    #include <semaphore.h>
    #include <fcntl.h>
    #include <time.h>
    #include <pthread.h>
#endif
