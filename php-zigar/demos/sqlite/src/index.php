<?php

require_once __DIR__ . '/VirtualFSStream.php';

$m = zigar_use(__DIR__ . '/../zig/search.zig');

$path = __DIR__ . '/../chinook.db';
$content = file_get_contents($path);
// create virtual file
$file = new VirtualFile($content);
// create virtual dir with one file
$dir = new VirtualDir([ 'chinook.db' => $file ]);
// add virtual dir to virtual FS as /root
VirtualFSStream::add_root_node('test', $dir);
// open directory using builtin PHP function
$handle = opendir('vfs://test');
// redirect the file system (for this module) to the virtual dir 
// (with the exception of /dev)
$m->__zigar->redirect('root', function($path) use($handle) {
    if (strpos($path, '/dev/') === false) {
        return $handle;
    }
});
$keyword = $_GET['q'] ?? '';
$results = ($keyword) ? $m->search('/chinook.db', $keyword) : [];
header('Content-Type: text/html; charset=utf-8');

?>
<html>
<head>
    <title>Album Search</title>
</head>
<body>
    <form>
        <input name="q"> <button>Search</button> 
    </form>
    <hr>
    <ul>
        <?php foreach($results as $album): ?>
            <li>
                <b><?= $album->Title ?></b> 
                by <i><?= $album->Artist ?></i> 
            </li>
        <?php endforeach; ?>
    </ul>
</body>
</html>
