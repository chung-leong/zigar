<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/type-handling/fn/as-static-variables.zig');

$m->func();
$m->func = $m->world;
$m->func();
