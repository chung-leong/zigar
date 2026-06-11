<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

// $m = zigar_use(__DIR__ . "/scratch.zig");
$m = zigar_use(__DIR__ . '/function-pointer/generator-with-allocator.zig');

$m->call(function() {
    $avengers = [
        [ 'real_name' => 'Tony Stark', 'superhero_name' => 'Ironman', 'age' => 53 ],
        [ 'real_name' => 'Peter Parker', 'superhero_name' => 'Spiderman', 'age' => 17 ],
        [ 'real_name' => 'Natasha Romanoff', 'superhero_name' => 'Black Widow', 'age' => 39 ],
    ];
    foreach ($avengers as $avenger) yield $avenger;
});
