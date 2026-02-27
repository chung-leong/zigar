<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class EnumHandlingTest extends TestCase
{   
    public function testImportEnumAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(1, (int) $m->Pet->cat);
        $this->assertSame('dog cat monkey', "{$m->Pet->dog} {$m->Pet->cat} {$m->Pet->monkey}");
        $this->assertSame($m->Pet->cat, $m->Pet(1));
        $this->assertSame(null, $m->Pet(5));
        $this->assertSame(true, $m->pet instanceof $m->Pet);
        $this->assertSame($m->Pet->cat, $m->pet);
        $this->assertSame($m->Donut->plain, $m->Donut(gmp_init('0')));
        $this->assertSame($m->Donut->jelly, $m->Donut(gmp_init('0xfffffffffffffffffffffffffffffffe')));
        $this->assertSame('@enumFromInt(5)', (string) $m->Donut(gmp_init('5')));

        $this->expectOutputString(<<<OUTPUT
        .cat
        .dog

        OUTPUT);
        $m->print();
        $m->pet = $m->Pet->dog;
        $m->print();        
    }

    public function testPrintEnumArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        .cat .dog

        OUTPUT);
        $m->print($m->Pet->cat, $m->Pet->dog);
    }

    public function testReturnEnum(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $result = $m->getEnum();
        $this->assertSame($m->Pet->cat, $result);
    }

    public function testHandleEnumInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleEnumInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleEnumInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleEnumAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleEnumInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleEnumInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleEnumInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleEnumInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleEnumInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

