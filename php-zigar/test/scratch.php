<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

foreach ($m->AnyError as $name => $error) {
    echo "$error\n";
}
