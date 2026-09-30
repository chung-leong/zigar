const php = @import("../root.zig");
const Array = php.Array;
const c = php.c;
const Value = php.Value;
pub const Functions = c.zend_object_iterator_funcs;
pub const Custom = @import("Iterator/Custom.zig").@"fn";
pub const Properties = @import("Iterator/Properties.zig").@"fn";

pub fn data(self: *@This()) *Value {
    return @ptrCast(&self.impl.data);
}

impl: c.zend_object_iterator,
