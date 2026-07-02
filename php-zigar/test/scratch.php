<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

$m->call(3, 
    new $m->Callback(function() {
        echo "Agnieszka\n";
    }),
    new $m->Callback(function() {
        echo "już dawno\n";
    }),
    new $m->Callback(function() {
        echo "tutaj nie mieszka\n";
    }),
);
