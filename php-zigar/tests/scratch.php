<?php

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$m->print('hello world');

debug_zval_dump($m->check("/php://memory"));