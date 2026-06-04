<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_import(__DIR__ . "/scratch.zig", function($name, $type) {
    return "test_$name";
});

test_hello(123);
print_r(test_array);

$obj = new test_i32_type(123);
echo $obj, "\n";

$m->__zigar->unimport();

// test_hello(123);
// $obj = new test_i32_type(123);
// echo $obj, "\n";
// print_r(test_array);
