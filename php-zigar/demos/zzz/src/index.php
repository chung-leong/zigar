<?php

require __DIR__ . '/../vendor/autoload.php';

ini_set('zigar.event_loop', 'revolt');

use Revolt\EventLoop;

EventLoop::defer(function() {
    $m = zigar_use(__DIR__ . '/../lib/server.zigar');
    $c = zigar_use(__DIR__ . '/../lib/cat.zigar');
    $m->setCatHandler($c->handleCat);
    $m->setBaseHandler(function ($url) {
        echo "$url\n";
        return <<<HTML
            <!DOCTYPE html>    
            <html>
            <title>Hello world</title>
            <body>
                <h1>Hello world!</h1>
                <p>You have accessed $url</p>
            </body>
            </html>
        HTML;
    });
    $m->startServer('0.0.0.0', 9862);
    echo "Server running\n";
});
EventLoop::run();
