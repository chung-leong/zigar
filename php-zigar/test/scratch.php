<?php

require __DIR__ . '/../vendor/autoload.php';

// use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$path = __DIR__ . '/stream-handling/data/test.txt';
$content = file_get_contents($path);
$url = 'data://text/plain;base64,' . base64_encode($content);

$f = fopen($url, 'r');
$result = $m->hash($f);

echo $result, "\n";
