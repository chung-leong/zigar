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

$m = zigar_use(__DIR__ . '/thread-handling/create-thread-with-string-generator.zig');

$m->startup();
try {
    $generator = $m->spawn();
    $list = [];
    foreach ($generator as $s) {
        $list[] = $s;
    }
    $generator = null;
} finally {
    $m->shutdown();
}
$m = null;
gc_collect_cycles();
echo "[GC COMPLETED]\n";
