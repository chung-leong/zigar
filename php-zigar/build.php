<?php

use PhpSchool\CliMenu\CliMenu;
use PhpSchool\CliMenu\Builder\CliMenuBuilder;
use PhpSchool\CliMenu\MenuItem\CheckboxItem;
use PhpSchool\CliMenu\MenuItem\RadioItem;
use PhpZip\ZipFile;

require_once(__DIR__ . '/vendor/autoload.php');

class Settings {
    function __construct() {
        $current_version = substr(PHP_VERSION, 0, strrpos(PHP_VERSION, '.'));
        switch (PHP_OS_FAMILY) {
            case 'Windows': $platform = 'windows'; break;
            case 'Darwin': $platform = 'macos'; break;
            case 'Linux': $platform = 'linux-gnu'; break;
        }
        switch (php_uname("m")) {
            case 'x86': $arch = 'x86'; break;
            case 'x86_64': $arch = 'x86_64'; break;
            case 'arm64':
            case 'aarch64': $arch = 'aarch64'; break;
            case 'risc64': $arch = 'risc64'; break;
            default: $arch = 'x86_64';
        }
        $current_target = "$arch-$platform";
        if ($platform === 'windows') {
            if (PHP_ZTS) {
                $current_target .= '-ts';
            }
        }
        $this->versions = [ $current_version ];
        $this->targets = [ $current_target ];
        $this->debug = PHP_DEBUG;
        $this->optimize = 'ReleaseSmall';
    }
}

$build = false;
$settings = new Settings;
if (is_callable('posix_isatty') && posix_isatty(STDIN)) {
    $menu = (new CliMenuBuilder)
        ->setTitle('PHP-Zigar Extension Build Script')
        ->addSubMenu('PHP version', function ($b) use($settings) {
            $b->setTitle('Select the version(s) of PHP for which you wish to create the extension');
            $versions = [ 
                '8.1' => "8.1.x", 
                '8.2' => "8.2.x",
                '8.3' => "8.3.x",
                '8.4' => "8.4.x", 
                '8.5' => "8.5.x",
            ];
            $cb = function($menu) use($versions, $settings) {
                $item = $menu->getSelectedItem();
                $id = array_search($item->getText(), $versions);
                $op = ($item->getChecked()) ? 'array_merge' : 'array_diff';
                $settings->versions = $op($settings->versions, [ $id ]);
                sort($settings->versions);
            };
            foreach ($versions as $id => $label) {
                $item = new CheckboxItem($label, $cb, false, false);
                if (in_array($id, $settings->versions)) {
                    $item->setChecked();
                }
                $b->addMenuItem($item);
            }
            $b->addLineBreak('-');
        })
        ->addSubMenu('PHP debug mode', function ($b) use($settings) {
            $b->setTitle('Select the debug mode of the PHP executable');
            $cb = function($menu) use($settings) {
                $item = $menu->getSelectedItem();
                $settings->debug = $item->getText() == 'Enabled';
            };
            foreach ([ false, true ] as $enabled) {
                $label = $enabled ? 'Enabled' : 'Disabled';
                $item = new RadioItem($label, $cb, false, false);
                if ($settings->debug == $enabled) {
                    $item->setChecked();
                }
                $b->addMenuItem($item);
            }
        })
        ->addSubMenu('Operation System', function ($b) use($settings) {
            $b->setTitle('Select the operation system(s) you wish to support');
            $targets = [
                'x86_64-linux-gnu' => "Linux x86 64-bit",
                'aarch64-linux-gnu' => "Linux ARM 64-bit",
                'x86_64-macos' => "MacOS x86 64-bit",
                'aarch64-macos' => "MacOS ARM 64-bit",
                'x86_64-windows' => "Windows x86 64-bit",
                'x86_64-windows-ts' => "Windows x86 64-bit (thread-safe)",
            ];
            $cb = function($menu) use($targets, $settings) {
                $item = $menu->getSelectedItem();
                $id = array_search($item->getText(), $targets);
                $op = ($item->getChecked()) ? 'array_merge' : 'array_diff';
                $settings->targets = $op($settings->targets, [ $id ]);
                sort($settings->targets);
            };
            foreach ($targets as $id => $label) {
                $item = new CheckboxItem($label, $cb, false, false);
                if (in_array($id, $settings->targets)) {
                    $item->setChecked();
                }
                $b->addMenuItem($item);
            }
            $b->addLineBreak('-');
        })
        ->addSubMenu('Optimization level', function ($b) use($settings) {
            $b->setTitle('Select the optimization level used to compile the extension');
            $levels = [ 'Debug', 'ReleaseSafe', 'ReleaseSmall', 'ReleaseFast' ];
            $cb = function($menu) use($settings) {
                $item = $menu->getSelectedItem();
                $settings->optimize = $item->getText();
            };
            foreach ($levels as $level) {
                $item = new RadioItem($level, $cb, false, false);
                if ($settings->optimize == $level) {
                    $item->setChecked();
                }
                $b->addMenuItem($item);
            }
        })
        ->addLineBreak('-')
        ->addItem('Build', function($menu) use(&$build) {
            $build = true;
            $menu->close();
        })
        ->setMarginAuto()
        ->setBackgroundColour(220, 'yellow')
        ->setForegroundColour(0, 'black')
        ->build();
    $menu->open();
} else {
    $build = true;
}

if (!$build) exit(0);

$results = [];
foreach ($settings->versions as $version) {
    foreach ($settings->targets as $target) {
        if (str_ends_with($target, '-ts')) {
            $target = substr($target, 0, -3);
            $ts = '/ts';
        } else {
            $ts = '';
        }
        [ $arch, $platform ] = explode('-', $target);
        $debug = ($settings->debug) ? 'with debug enabled ' : '';
        echo "Building extension at optimization level \"$settings->optimize\" for PHP $version $debug($platform/$arch$ts)\n";
        $devel_path = join(DIRECTORY_SEPARATOR, [ __DIR__, 'php-devel', $version ]);
        if (!file_exists($devel_path)) {
            $links = [
                '8.1' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.1.34-Win32-vs16-x64.zip",
                '8.2' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.2.32-Win32-vs16-x64.zip",
                '8.3' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.3.32-Win32-vs16-x64.zip",
                '8.4' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.4.23-Win32-vs17-x64.zip",
                '8.5' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.5.8-Win32-vs17-x64.zip",
            ];
            $link = $links[$version];
            echo "Downloading $link\n";
            $zip_contents = file_get_contents($link);
            if (!in_array("var", stream_get_wrappers())) {
                stream_wrapper_register("var", "VariableStream");
            }
            $zip_path = "var://zip_contents";
            $zip_file = new ZipFile();
            $zip_file->openFile($zip_path);
            foreach($zip_file as $name => $contents) {
                if (str_ends_with($name, '/')) continue;
                $parts = explode('/', $name);
                $parts[0] = $devel_path;
                $dest_path = join(DIRECTORY_SEPARATOR, $parts);
                $dest_dir = dirname($dest_path);
                if (!file_exists($dest_dir)) {
                    mkdir($dest_dir, 0777, true);
                }
                if ($version <= '8.4') {
                    $src_path = join('/', array_slice($parts, 1)); 
                    switch ($src_path) {
                        case 'include/win32/ioutil.h':
                        case 'include/win32/codepage.h':
                            // correct syntax considered legal only by Microsoft Visual C
                            $contents = str_replace('__forceinline', 'zend_always_inline', $contents);
                            break;
                    }
                }
                file_put_contents($dest_path, $contents);
            }
        }
        $include_path = join(DIRECTORY_SEPARATOR, [ $devel_path, 'include' ]);
        $so_rel_parts = [ 'extensions', $version ];
        if ($arch != 'x86_64')  {
            $so_rel_parts[] = $arch;
        }
        if ($ts) {
            $so_rel_parts[] = 'TS';
        }
        $so_rel_path = join(DIRECTORY_SEPARATOR, $so_rel_parts);
        $so_path = join(DIRECTORY_SEPARATOR, [ $so_rel_path ]);
        $cmd = [ 
            'zig',
            'build', 
            "-Dtarget=$target",
            "-Doptimize=$settings->optimize",
            "-Dphp-include=$include_path",
            "-Dphp-extension=$so_path",
        ];
        if ($settings->debug) {
            $cmd[] = "-Dphp-debug";
        }
        if ($ts) {
            $cmd[] = "-Dphp-ts";
        }
        $zig = proc_open($cmd, [ STDIN, STDOUT, STDERR ], $pipes, null, null, [
            'bypass_shell' => true,
        ]);
        if (proc_close($zig) == 0) {
            switch ($platform) {
                case 'windows': $so_ext = 'dll'; break;
                case 'macos': $so_ext = 'dylib'; break;
                default: $so_ext = 'so'; break;
            }
            $results[] = join(DIRECTORY_SEPARATOR, [ $so_rel_path, "php_zigar.$so_ext" ]);
        }
    }
}
$count = count($results);
$libraries = ($count === 1) ? 'library' : 'libraries';
echo "Created $count dynamic-linked $libraries:\n\n";
foreach ($results as $path) {
    echo "$path\n";
}

class VariableStream {
    var $position;
    var $varname;
    var $context;

    function stream_open($path, $mode, $options, &$opened_path)
    {
        $url = parse_url($path);
        $this->varname = $url["host"];
        $this->position = 0;

        return true;
    }

    function stream_read($count)
    {
        $ret = substr($GLOBALS[$this->varname], $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }

    function stream_write($data)
    {
        $left = substr($GLOBALS[$this->varname], 0, $this->position);
        $right = substr($GLOBALS[$this->varname], $this->position + strlen($data));
        $GLOBALS[$this->varname] = $left . $data . $right;
        $this->position += strlen($data);
        return strlen($data);
    }

    function stream_tell()
    {
        return $this->position;
    }

    function stream_eof()
    {
        return $this->position >= strlen($GLOBALS[$this->varname]);
    }

    function stream_seek($offset, $whence)
    {
        switch ($whence) {
            case SEEK_SET:
                if ($offset < strlen($GLOBALS[$this->varname]) && $offset >= 0) {
                     $this->position = $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            case SEEK_CUR:
                if ($offset >= 0) {
                     $this->position += $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            case SEEK_END:
                if (strlen($GLOBALS[$this->varname]) + $offset >= 0) {
                     $this->position = strlen($GLOBALS[$this->varname]) + $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            default:
                return false;
        }
    }

    function stream_stat()
    {
        return [ 'size' => strlen($GLOBALS[$this->varname]) ];
    }

    function stream_metadata($path, $option, $var) 
    {
        if($option == STREAM_META_TOUCH) {
            $url = parse_url($path);
            $varname = $url["host"];
            if(!isset($GLOBALS[$varname])) {
                $GLOBALS[$varname] = '';
            }
            return true;
        }
        return false;
    }

    function url_stat($path, $flags)
    {
        $url = parse_url($path);
        $varname = $url["host"];
        if (!isset($GLOBALS[$varname])) return false;
        return [ 'size' => strlen($GLOBALS[$varname]) ];
    }
}
