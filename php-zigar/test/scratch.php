<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");
try {
    $m->fail();
} catch (Exception $e) {
    echo $e->getTraceAsString();
}
 
