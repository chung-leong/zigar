<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$cat_img_data = str_repeat("\x00", 8000);
$dog_img_data = str_repeat("\x00", 16000);

$m->printDirectoryTree([
    'name' => 'root',
    'entries' => [
        [ 'file' => [ 'name' => 'README', 'data' => 'Hello world' ] ],
        [
            'dir' => [
                'name' => 'images',
                'entries' => [
                    [ 'file' => [ 'name' => 'cat.jpg', 'data' => $cat_img_data ] ],
                    [ 'file' => [ 'name' => 'dog.jpg', 'data' => $dog_img_data ] ],
                ]
            ]
        ],
        [ 
            'dir' => [
                'name' => 'src',
                'entries' => [
                    [ 'file' => [ 'name' => 'index.js', 'data' => 'while (true) alert("You suck!")' ] ],
                    [ 'dir' => [ 'name' => 'empty', 'entries' => [] ] ],
                ]
            ]
        ]
    ]
]);