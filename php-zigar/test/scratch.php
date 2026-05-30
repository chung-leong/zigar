<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$buf = new ArrayBuffer(400);
$ta = new Uint32Array($buf, 4);
$ta[2] = 73;
$ta[10] = 1234;
print_r($ta);
print_r($buf);
