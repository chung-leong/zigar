const std = @import("std");

const php = @import("php.zig");
const Value = php.Value;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const String = php.String;
const HashTable = php.HashTable;
const zig_class_entry = @import("zig-class.zig");
const ZigClass = zig_class_entry.ZigClass;

pub fn ZigObject(comptime T: type) type {
    const Result = struct {
        zig_portion: T = .{},
        php_portion: php.Object = .{},

        var object_handlers: ?ObjectHandlers = null;

        pub fn object(self: *@This()) *Object {
            return &self.php_portion;
        }

        pub fn fromObject(obj: *Object) *@This() {
            return @fieldParentPtr("php_portion", obj);
        }

        pub fn create(class: *ZigClass) !*@This() {
            const prop_size = php.getObjectPropertySize(class.entry());
            const size: usize = @intCast(@sizeOf(@This()) + prop_size);
            const alignment = comptime std.mem.Alignment.fromByteUnits(@alignOf(@This()));
            const bytes = try php.allocator.alignedAlloc(u8, alignment, size);
            errdefer php.allocator.free(bytes);
            const self: *@This() = @ptrCast(@alignCast(&bytes[0]));
            self.* = .{};
            const obj = self.object();
            obj.handlers = getHandlers();
            php.initializeStandardObject(self.object(), class.entry());
            php.initializeObjectProperties(self.object(), class.entry());
            class.addRef();
            return self;
        }

        fn getHandlers() *ObjectHandlers {
            if (object_handlers == null) {
                const handlers = &object_handlers.?;
                inline for (comptime std.meta.fields(@TypeOf(php.object_handler_mapping))) |field| {
                    const func_name = @field(php.object_handler_mapping, field.name);
                    @field(handlers, field.name) = if (@hasDecl(T, func_name))
                        php.transform(@field(@This(), func_name))
                    else
                        @field(php.std_object_handlers, field.name);
                }
                handlers.offset = @offsetOf(@This(), "php_portion");
            }
            return &object_handlers.?;
        }
    };
    if (@offsetOf(Result, "php_portion") + @sizeOf(Object) != @sizeOf(Result))
        @compileError("PHP object is in the wrong position");
    return Result;
}
