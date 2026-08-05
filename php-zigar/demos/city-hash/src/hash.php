<?php

$m = zigar_use(__DIR__ . '/../zig/hash.zig');

$hash = $m->hash("Hello world", uppercase: true, seeds: [ 1234, 5678 ]);
echo "$hash\n";
