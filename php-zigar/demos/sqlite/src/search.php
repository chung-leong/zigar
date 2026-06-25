<?php

$m = zigar_use(__DIR__ . '/../zig/search.zig');

$path = __DIR__ . '/../chinook.db';
$keyword = $_GET['q'] ?? '';
$result = $m->search($path, $keyword);
header('Content-Type: application/json; charset=utf-8');
echo json_encode($result, JSON_PRETTY_PRINT);
