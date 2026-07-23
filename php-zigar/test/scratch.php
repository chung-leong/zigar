<?php

$m = zigar_import(__DIR__ . '/scratch.zig', function($name, $type) {
    return $name;
});

$point = new Point(x: 123, y: 456);
print_r($point);
