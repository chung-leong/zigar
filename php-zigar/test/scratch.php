<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");
$zigar = $m->__zigar;

echo $zigar->typeOf($m->Error);
