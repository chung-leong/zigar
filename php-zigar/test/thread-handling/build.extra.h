#define _GNU_SOURCE
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
