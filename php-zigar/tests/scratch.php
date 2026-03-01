<?php

require __DIR__ . '/../vendor/autoload.php';

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$m->array = [ 10, 20, 30, 40 ];