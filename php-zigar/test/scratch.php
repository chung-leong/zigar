<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$str1 = "Hello world";
$m->puts($str1);
$stderr = $m->stream(2);
$str2 = "Hello world!\n";
$m->fwrite($str2, 1, strlen($str2), $stderr);
$stdout = $m->stream(1);
$str3 = "Hello?";
$m->fwrite($str3, 1, strlen($str3), $stdout);
$m->fflush($stdout);
$m->fwrite("\n", 1, 1, $stdout);
$str4 = "Hello world";
$m->put_s($str4);

gc_collect_cycles();
echo "gc completed\n";
