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

$m = zigar_use(__DIR__ . '/scratch.zig');

$list = $m->get(100);

foreach($list as $item) {
    debug_zval_dump($item);
}
