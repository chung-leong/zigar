<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

class Test {
    var $world = "Hello world";
}

for ($i = 0; $i < 3; $i++) {   
    $m = ($i === 0) ? new Test : zigar_use(__DIR__ . '/scratch.zig');
    echo $m->world, "\n";
}
