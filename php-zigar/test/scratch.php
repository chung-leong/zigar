<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$s = new $m->Struct();
echo $s->characters, "\n";
$bytes = $s->characters->__bytes;

echo $bytes, "\n";
$s->characters[0] += 1;
echo $bytes, "\n";
