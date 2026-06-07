<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$s = $m->dupe("Hello world!", allocator: $m->allocator);
echo $s, "\n";
$m->free($s);

$s = new $m->Slice("Hello world!", allocator: $m->allocator);
echo $s, "\n";
$m->free($s);
