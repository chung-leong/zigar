<?php

$m = zigar_import(__DIR__ . '/scratch.zig', function($name, $type) {
    if ($type === 'class') return false;
    return $name;
});

hello();
