<?php

$m = zigar_use(__DIR__ . '/scratch.zig');

ob_start();
$m->hello();
$text = ob_get_clean();
echo "text = $text\n";

require_once __DIR__ . '/VirtualFSStream.php';

$dir = new VirtualDir([
    'hello.txt' => new VirtualFile('Hello world'),
    'test.txt' => new VirtualFile('This is a test and this is only a test'),
    'world' => new VirtualDir(),
]);
VirtualFSStream::add_root_node('test', $dir);
$handle = opendir('vfs://test');
$m->print($handle);
