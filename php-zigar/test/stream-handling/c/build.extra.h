#define _GNU_SOURCE
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <dirent.h>
#include <sys/stat.h>
#include <sys/file.h>
#include <sys/time.h>

#ifdef _WIN32
    #include <windows.h>
    #include <utime.h>
#endif
