<?php

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

function callback($arg) {
    echo "received $arg\n";
    return $arg * 10;
}

$m->call('callback', 1234);
