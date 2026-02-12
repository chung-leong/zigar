<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

$suspension = EventLoop::getSuspension();
$stream = zigar_get_pipe();

debug_zval_dump($stream);

$readableId = EventLoop::onReadable($stream, function ($id, $stream) use ($suspension): void {
    EventLoop::cancel($id);
    print "onReadable\n";
    zigar_run_next();
    $suspension->resume(null);
});

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

function callback($arg) {
    echo "received $arg\n";
    return $arg * 10;
}

$m->call('callback', 1234);

$suspension->suspend();
