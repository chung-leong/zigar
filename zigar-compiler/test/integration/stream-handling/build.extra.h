#define _GNU_SOURCE
#include <stdio.h>

#ifdef _WIN32
    #include <windows.h>
    #include <utime.h>
#else
    #include <unistd.h>
    #include <dirent.h>
    #include <fcntl.h>
    #include <sys/file.h>
    #include <sys/stat.h>
    #include <sys/time.h>
#endif
