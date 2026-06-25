<?php

$m = zigar_use(__DIR__ . '/../zig/search.zig');

$path = __DIR__ . '/../chinook.db';
$keyword = $_GET['q'] ?? '';
$results = ($keyword) ? $m->search($path, $keyword) : [];
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
