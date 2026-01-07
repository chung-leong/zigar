PHP_ARG_ENABLE(php_zigar, whether to enable PHP Zigar,
[ --enable-php-zigar   Enable PHP Zigar support])

if test "$PHP_ZIGAR" != "no"; then
    PHP_REQUIRE_CXX()
    PHP_ADD_LIBRARY(stdc++, 1, PHP_ZIGAR_SHARED_LIBADD)
    PHP_SUBST(PHP_ZIGAR_SHARED_LIBADD)
    PHP_ADD_LIBRARY_WITH_PATH(php_zigar, $(pwd)/zig-out/lib, PHP_ZIGAR_SHARED_LIBADD)
    PHP_NEW_EXTENSION(php_zigar, src/extension.c, $ext_shared)
fi
