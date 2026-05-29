<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

debug_zval_dump($m->int_ptr * 2);
debug_zval_dump($m->int_ptr == 12345);
$m->int_ptr *= 2;
debug_zval_dump(-$m->int_ptr);