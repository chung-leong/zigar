<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig', [ 'Hello' => 5 ]);
print_r($m->struct_a);
$m->print();
