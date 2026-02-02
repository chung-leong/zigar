<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class EnumLiteralHandlingTest extends TestCase
{   
    public function testImportEnumLiteralAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame('hello', $m->hello);

        $worlds = [
            'Asgard',
            'Midgard',
            'Jotunheim',
            'Svartalfheim',
            'Vanaheim',
            'Muspelheim',
            'Niflheim',
            'Alfheim',
            'Nidavellir',
        ];
        foreach($worlds as $index => $world) {
            // world is a tuple
            $this->assertSame($world, $m->world[$index]);
        }
    }

    public function testIgnoreFunctionAcceptingEnumLiteral(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectExceptionMessage('Call to undefined method');
        $m->print();
    }

    public function testReturnEnumLiteral(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->expectExceptionMessage('Call to undefined method');
        $m->getLiteral();
    }

    public function testHandleEnumLiteralInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $words = [ 'hello', 'world', 'dog', 'cat' ];
        foreach ($words as $key => $word) {
            $this->assertSame($word, $m->array[$key]);
        }
    }

    public function testHandleEnumLiteralInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testFailToCompileCodeWithEnumLiteralInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleEnumLiteralAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleEnumLiteralInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleEnumLiteralInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleEnumLiteralInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame('hello', $m->optional);

        $this->expectOutputString(<<<OUTPUT
        .hello

        OUTPUT);
        $m->print();
    }

    public function testHandleEnumLiteralInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame('hello', $m->error_union);

        $this->expectOutputString(<<<OUTPUT
        .hello

        OUTPUT);
        $m->print();
    }

    public function testFailToCompileCodeContaingEnumLiteralInVector(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

