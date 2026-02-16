<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

// $m->printB();

echo $m->struct_b->number2, "\n";

// $a = gmp_init(1234);

// $m->bigint = "123456789123456789";

// $m->print();
