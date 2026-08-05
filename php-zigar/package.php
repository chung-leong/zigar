<?php

use PhpZip\ZipFile;

error_reporting(E_ALL ^ E_DEPRECATED);

require_once(__DIR__ . '/vendor/autoload.php');

$composer_cfg = json_decode(file_get_contents("composer.json"));
$version = $composer_cfg->version;
$package_name = "php-zigar-$version";
$filename = "$package_name.zip";
if (file_exists($filename)) {
    unlink($filename);
}

$ignore = <<<PATTERNS
.phpunit.cache
.zig-cache
demos
doc
extensions
php-devel
test
vendor/myclabs
vendor/nikic
vendor/phar-io
vendor/phpunit
vendor/psr
vendor/revolt
vendor/sebastian
vendor/symfony
vendor/theseer
zig

.gitignore
build$
build.ini
composer.*
package$
package.php
phpunit.xml
php-zigar-\d+.\d+.\d+.zip.*
zstd-tarball
PATTERNS;
$filters = preg_split('/[\r\n]+/', $ignore, -1, PREG_SPLIT_NO_EMPTY);
$patterns = array_map(function($s) {
    return "@^$s@";
}, $filters);

chdir(__DIR__);
$rdi = new RecursiveDirectoryIterator(".", FilesystemIterator::SKIP_DOTS | FilesystemIterator::UNIX_PATHS | FilesystemIterator::FOLLOW_SYMLINKS);
$rii = new RecursiveIteratorIterator($rdi, RecursiveIteratorIterator::SELF_FIRST);
$paths = [];
foreach ($rii as $path) {
    $path = substr($path, 2);
    $include = true;
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $path)) {
            $include = false;
            break;
        }
    } 
    if ($include) {
        $paths[] = $path;
    }
};

$src_patterns = [];
foreach ($filters as $s) {
    if (str_starts_with($s, 'vendor/')) {
        $s = substr($s, 7);
        $src_patterns[] = "@'/$s@";
    }
}
$zip_file = new ZipFile();
$zip_file->setCompressionLevel(9);
foreach ($paths as $path) {
    $dest_path = "$package_name/$path";
    if (is_dir($path)) {
        $zip_file->addEmptyDir($dest_path);
    } else {
        $data = file_get_contents($path);
        if (preg_match('@^vendor/composer/.*\.php@', $path)) {
            $lines = preg_split('@[\r\n]+@', $data, -1, PREG_SPLIT_NO_EMPTY);
            $lines = array_filter($lines, function($line) use($src_patterns) {
                foreach($src_patterns as $src_pattern) {
                    if (preg_match($src_pattern, $line)) {
                        return false;
                    }
                }
                return true;
            });
            $data = implode("\n", $lines);
        }
        $zip_file->addFromString($dest_path, $data);
    }
}
$zip_file->saveAsFile($filename);
$size = round(filesize($filename) / 1024);
echo "Saved $filename ($size kb)\n";
