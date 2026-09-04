<?php

$m = zigar_use(__DIR__ . '/../zig/lua.zig');

$code = trim($_GET['lua'] ?? '');
ob_start();
if ($code) {
    $lua = $m->createLua();
    try {
        $m->runLuaCode($lua, $code);
    } catch (Exception $e) {
        echo $e;
    } finally {
        $m->freeLua($lua);
    }
}
$output = ob_get_clean();

?>
<html>
<head>
    <title>Lua interpretor</title>
    <style>
        textarea {
            font-family: monospace;
            width: 100%;
            height: 50vh;
            margin-bottom: .5em;
        }
    </style>        
</head>
<body>
    <form>
        <textarea name="lua"><?= htmlspecialchars($code) ?></textarea> 
        <div><button type="submit">Run</button>
    </form>
    <hr>
    <pre><?= htmlspecialchars($output) ?></pre>
</body>
</html>
