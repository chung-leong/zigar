<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

ob_start();
$m->hello();
$text = ob_end_clean();
