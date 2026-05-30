<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

echo "$m->ptr\n";
$m->ptr->{'*'}++;
echo "$m->ptr\n";
