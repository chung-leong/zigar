<?php

$targets = [
    [ 'platform' => 'linux', 'arch' => 'x64' ],
    [ 'platform' => 'linux', 'arch' => 'arm64' ],
    [ 'platform' => 'darwin', 'arch' => 'arm64' ],
    [ 'platform' => 'win32', 'arch' => 'x64' ],
];
foreach ($targets as $options) {
    zigar_compile(__DIR__ . '/../zig/hash.zig', $options);
}
