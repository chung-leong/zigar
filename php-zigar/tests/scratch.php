<?php

require __DIR__ . '/../vendor/autoload.php';

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

debug_zval_dump((bool) $m->function);
debug_zval_dump(isset($m->number));
debug_zval_dump(isset($m->function));
