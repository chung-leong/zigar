<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$m->User->print([
    'id' => 1234,
    'name' => "Bigus Dickus",
    'email' => "madeupname12@rome.gov.it",
    'age' => 32,
    'address' => [
        'street' => '1 Colosseum Sq.',
        'city' => 'Rome',
        'state' => 'NY',
        'zipCode' => '10001',
    ],
]);
