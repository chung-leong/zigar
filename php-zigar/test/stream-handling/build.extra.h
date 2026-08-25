#define _GNU_SOURCE
#include <stdio.h>
#include <utime.h>
#include <unistd.h>
#include <dirent.h>
#include <fcntl.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <sys/time.h>

#ifdef _WIN32
    #include <windows.h>
#endif
