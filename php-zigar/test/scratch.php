<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$ta = new Uint32Array(20);
$ta[2] = 73;
$ta[10] = 1234;
print_r($ta);
