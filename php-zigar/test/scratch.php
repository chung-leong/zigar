<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/thread-handling/create-thread-with-allocating-generator.zig');

$m->startup();
try {
    $generator = $m->spawn();
    $list = [];
    foreach ($generator as $s) {
        $list[] = $s;
    }
    print_r($list);
} finally {
    $m->shutdown();
}

