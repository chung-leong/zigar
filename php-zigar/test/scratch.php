<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo $m->utf16, "\n";
echo $m->utf16_slice, "\n";
$m->utf16 = "hello";
echo $m->utf16_slice, "\n";

try {
    $m->utf16 = "world!";
} catch (Exception $err) {
    echo $err->getMessage(), "\n";
}
echo $m->utf16_slice, "\n";

try {
    $m->utf16 = "Hello!";
} catch (Exception $err) {
    echo $err->getMessage(), "\n";
}

$m->utf16_slice = "część!";
echo $m->utf16_slice, "\n";

echo $m->utf8_slice, "\n";
$m->utf8_slice = "część, świecie!";
echo $m->utf8_slice, "\n";

$m = null;
gc_collect_cycles();
echo "gc finished\n";