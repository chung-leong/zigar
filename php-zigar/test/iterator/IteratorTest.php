<?php declare(strict_types=1);

final class IteratorTest extends ZigarTestCase
{   
    public function testStructIterator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/struct-iterator.zig');
        $list = [];
        foreach ($m->getStruct() as $token) {
            $list[] = $token->__string;
        }
        $this->assertSame([ "apple", "orange", "lemon" ], $list);
    }

    public function testUnionIterator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/union-iterator.zig');
        $list = [];
        foreach ($m->getUnion() as $token) {
            $list[] = $token->__string;
        }
        $this->assertSame([ "apple", "orange", "lemon" ], $list);
    }

    public function testOpaqueIterator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/opaque-iterator.zig');
        $list = [];
        foreach ($m->getOpaque() as $token) {
            $list[] = $token->__string;
        }
        $this->assertSame([ "orange", "lemon" ], $list);
    }

    public function testSplitSequenceIterator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/split-iterator.zig');
        $s = 'hello||world||123||chicken';
        $list = [];
        foreach($m->split($s, '||') as $token) {
            $list[] = $token->__string;
        }
        $this->assertSame([ 'hello', 'world', '123', 'chicken' ], $list);
    }

    public function testPathComponentIterator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/path-iterator.zig');
        $path = '/home/chicken/porn/naked-chicks.png';
        $list = [];
        foreach($m->parsePath($path) as $part) {
            $list[] = $part->name->__string;
        }
        $this->assertSame([ 'home', 'chicken', 'porn', 'naked-chicks.png' ], $list);
    }
}