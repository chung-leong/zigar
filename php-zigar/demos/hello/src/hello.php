<?php

$m = zigar_import(__DIR__ . '/../zig/hello.zig', function($name, $type) {
    return "cow_{$name}_${type}";
});

cow_hello_function();
