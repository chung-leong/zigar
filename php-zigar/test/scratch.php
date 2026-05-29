<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$f = $m->fopen('anyopaque-pointer-example-2-out.txt', 'w');
$buffer = new $m->PtrVoid("Cześć! Jak się masz?\n");
$m->fwrite($buffer, count($buffer), 1, $f);
$m->fclose($f);
