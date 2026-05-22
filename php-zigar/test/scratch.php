<?php

require __DIR__ . '/../vendor/autoload.php';

// use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

// echo isset($m->a->number1), "\n";
unset($m->a->number1);
// echo $m->a->number1, "\n";
