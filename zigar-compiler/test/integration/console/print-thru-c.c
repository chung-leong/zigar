#include <stdio.h>
#include <unistd.h>

void test_printf(void) {
    printf("Hello %d\n", (int) 1234);
    printf("Hello %s\n", "Richard Nixon");
}

void test_fprintf(void) {
    int n = 1234;
    double f = 3.14;
    fprintf(stderr, "Hello %d %.2f\n", n, f);
    fprintf(stderr, "Hello %s\n", "Joe Blow");
}

void test_putc(void) {
    putc('H', stdout);
    putc('\n', stdout);
}

void test_fputc(void) {
    fputc('H', stdout);
    fputc('\n', stdout);
}

void test_putchar(void) {
    putchar('H');
    putchar('\n');
}

void test_fputs(void) {
    fputs("Hello world\n", stderr);
}

void test_puts(void) {
    puts("Hello world");
}

void test_fwrite(void) {
    const char s[] = "Hello world";
    fwrite(s, sizeof(char), sizeof(s) - 1, stdout);
}

void test_write(void) {
    const char s[] = "Hello world";
    write(2, s, sizeof(s) - 1);
}

void test_perror(void) {
    perror("Hello");
}
