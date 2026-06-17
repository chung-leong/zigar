<?php

// require __DIR__ . '/../vendor/autoload.php';

// use Revolt\EventLoop;

// class Hello {
//     function __get($name) {
//         return "Hello $num";
//     }
// }


// $h = new Hello;
// echo debug_zval_dump($h->string);

$m = zigar_use(__DIR__ . '/type-handling/error-set/as-static-variables.zig');

$m->error_var = $m->NormalError->OutOfMemory;
