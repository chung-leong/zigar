<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");
try {
    $m->fail();
} catch (Exception $e) {
    echo json_encode($e);
    print_r($e);
}
$int32 = new $m->Int32(1234);
print_r($int32);
 
echo json_encode($m->Enum->alpha), "\n";
print_r($m->Enum->alpha);
