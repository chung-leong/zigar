<?php

require __DIR__ . '/../vendor/autoload.php';

// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");
$array = $m->get4Big(50);
$array->__typed_array[3] = 1000;
print_r($array);
