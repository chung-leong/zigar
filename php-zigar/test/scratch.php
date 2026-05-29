<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");
$zigar = $m->__zigar;

$point = new $m->Point(x: 0, y: 0);
$m->memset($point, $zigar->sizeOf($m->Point), 0xFF);
print_r($point);

$points = new $m->Points(3);
$m->memset($points, count($points) * $zigar->sizeOf($m->Point), 1);
print_r($points);

$ta = new Uint32Array(4);
$m->memset($ta, $ta->byteLength, 0xFF);
print_r($ta);