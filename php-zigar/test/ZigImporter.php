<?php declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

final class ZigImporter 
{
    static $optimize = 'Debug';
    static $initialized = false;
    
    public static function load($src_path, $options = []) 
    {
        if (!self::$initialized) {
            $env = getenv();
            if (isset($env['OPTIMIZE'])) {
                self::$optimize =  $env['OPTIMIZE'];
            }
            self::$initialized = true;
        }
        $info = pathinfo($src_path);
        $options['optimize'] = self::$optimize;
        $mod_path = "{$info['dirname']}/lib/{$info['filename']}.zigar";
        zigar_compile($src_path, $mod_path, $options);
        return zigar_load($mod_path);
    }

    public static function safetyCheck() {
        return self::$optimize === 'Debug' || self::$optimize === 'ReleaseSafe';
    }
}
