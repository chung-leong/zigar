<?php declare(strict_types=1);

final class ZigImporter 
{
    public static function load($src_path) 
    {
        $info = pathinfo($src_path);
        $mod_path = "{$info['dirname']}/lib/{$info['filename']}.zigar";
        zigar_compile_module($src_path, $mod_path);
        return zigar_load_module($mod_path);
    }
}

