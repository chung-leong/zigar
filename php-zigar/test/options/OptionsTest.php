<?php declare(strict_types=1);

final class OptionsTest extends ZigarTestCase
{   
    public function testOmitFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/omit-functions.zig', [
            'omit_functions' => true,
        ]);
        $this->assertFalse(method_exists($m, 'a'));
        $this->assertFalse(method_exists($m, 'b'));
        $this->assertFalse(method_exists($m, 'c'));
    }

    public function testOmitVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/omit-variables.zig', [
            'omit_variables' => true,
        ]);
        $this->assertTrue(property_exists($m, 'a'));
        $this->assertFalse(property_exists($m, 'b'));
        $this->assertFalse(property_exists($m, 'c'));
    }

    public function testDisableIoRedirection(): void
    {
        $m = ZigImporter::load(__DIR__ . '/disable-redirection.zig', [
            'use_redirection' => false,
        ]);        
        $zigar = $m->__zigar;
        $this->assertExceptionMessage('redirection disabled', function() use($zigar) {
            $zigar->redirect('stdout', 'php://memory');
        });
        $this->assertExceptionMessage('redirection disabled', function() use($zigar) {
            $dir = new VirtualDir();
            VirtualFSStream::add_root_node('test', $dir);
            $zigar->redirect('root', 'vfs://test');
        });
        $this->assertTrue($m->check(__FILE__));
    }
}
