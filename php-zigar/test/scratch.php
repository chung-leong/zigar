<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$a = new $m->StructA(apple: true, durian: true);
debug_zval_dump((int) $a);
debug_zval_dump($a == 9);
