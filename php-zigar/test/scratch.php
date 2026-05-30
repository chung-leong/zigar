<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$array = new Float64Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
$m->printPoints($m->Points($array->buffer));
$subarray = new Uint8Array($array->buffer, 16, 16);
$m->printPoint($m->Point($subarray));
