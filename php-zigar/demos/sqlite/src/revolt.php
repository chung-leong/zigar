<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

ini_set('zigar.event_loop', 'revolt');

EventLoop::defer(function (): void {
    $m = zigar_use(__DIR__ . '/../zig/async.zig');

    $m->startup(4);
    $path = __DIR__ . '/../chinook.db';
    $keyword = $_GET['q'] ?? '';
    $result = $m->search($path, $keyword);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($result, JSON_PRETTY_PRINT);

    $m->shutdown();
});
EventLoop::defer(function (): void {
    echo "[doing something else]\n";
});
EventLoop::run();