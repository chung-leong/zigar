<?php

use PhpSchool\CliMenu\CliMenu;
use PhpSchool\CliMenu\Builder\CliMenuBuilder;
use PhpSchool\CliMenu\MenuItem\CheckboxItem;
use PhpSchool\CliMenu\MenuItem\RadioItem;

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

$settings = new Settings;
$build = false;

$links = [
    '8.1' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.1.34-Win32-vs16-x64.zip",
    '8.2' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.2.32-Win32-vs16-x64.zip",
    '8.3' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.3.32-Win32-vs16-x64.zip",
    '8.4' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.4.23-Win32-vs17-x64.zip",
    '8.5' => "https://downloads.php.net/~windows/releases/php-devel-pack-8.5.8-Win32-vs17-x64.zip",
];

$itemCallable = function (CliMenu $menu) {
    $item = $menu->getSelectedItem();
    echo $item->getText(), "\n";
};

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
        $cb = function($menu) use($versions, $settings) {
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
            'aarch64-windows' => "Windows ARM 64-bit",
            'aarch64-windows-ts' => "Windows ARM 64-bit (thread-safe)",
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
        $cb = function($menu) use($versions, $settings) {
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

if ($build) {
    echo "Building...\n";
    print_r($settings);
}
