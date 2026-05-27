<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

echo $m->union_value, "\n";
debug_zval_dump($m->union_value == 'dog');
