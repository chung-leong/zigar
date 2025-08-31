#include <stdio.h>

void scan_file_with_fscanf(int fd) {
    FILE* file = fdopen(fd, "r");
    if (!file) {
        printf("Cannot open file!\n");
        return;
    }
    int a, b, c;
    char buffer[128];
    int count;
    do {
        count = fscanf(file, "%d %d %d %s", &a, &b, &c, buffer);
        if (count == 4) {
            printf("%d %d %d %s\n", a, b, c, buffer);
        } else if (count > 0) {
            printf("count = %d\n", count);
        }
    } while (count > 0);
    fclose(file);
}

void scan_stdin_with_scanf() {
    int a, b, c;
    char buffer[128];
    int count;
    do {
        count = scanf("%d %d %d %s", &a, &b, &c, buffer);
        if (count == 4) {
            printf("%d %d %d %s\n", a, b, c, buffer);
        } else if (count > 0) {
            printf("count = %d\n", count);
        }
    } while (count > 0);
}

void scan_stdin_with_scanf_once() {
    int a, b, c;
    char buffer[128];
    int count;
    count = scanf("%d %d %d %s", &a, &b, &c, buffer);
    if (count == 4) {
        printf("%d %d %d %s\n", a, b, c, buffer);
    } else if (count > 0) {
        printf("count = %d\n", count);
    }
}
