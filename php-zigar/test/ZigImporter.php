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
        return zigar_use($src_path, $options);
    }

    public static function safetyCheck() {
        return self::$optimize === 'Debug' || self::$optimize === 'ReleaseSafe';
    }
}
