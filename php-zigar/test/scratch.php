<?php

$m = zigar_use(__DIR__ . '/scratch.zig');

$m->call(function() {
    for ($i = 0; $i < 5; $i++) yield $i;
});
$m->call(function() {
    for ($i = 6; $i < 20; $i++) yield $i;
});
$m->call(function($callback) {
    for ($i = 6; $i < 20; $i++) {
        if (!$callback($i)) {
            break;
        }
    }
});
