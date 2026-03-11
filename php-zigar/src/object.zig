const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const php = @import("php.zig");
const HashTable = php.HashTable;
const ObjectHandlers = php.ObjectHandlers;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub fn ZigObject(comptime S: type) type {
    const Result = struct {
        zig_portion: S = .{},
        php_portion: php.Object = .{},

        var object_handlers: ?ObjectHandlers = null;

        pub fn object(self: *@This()) *Object {
            return &self.php_portion;
        }

        pub fn structure(self: *@This()) *S {
            return &self.zig_portion;
        }

        pub fn fromObject(obj: *Object) *@This() {
            return @fieldParentPtr("php_portion", obj);
        }

        pub fn fromStructure(s: *S) *@This() {
            return @alignCast(@fieldParentPtr("zig_portion", s));
        }

        pub fn create(class: *ZigClassEntry) !*@This() {
            const prop_size = php.getObjectPropertySize(class.entry());
            const size: usize = @intCast(@sizeOf(@This()) + prop_size);
            // we can't use the allocator here, since freeing is done by PHP itself
            const mem = php.emalloc(size) orelse return error.OutOfMemory;
            errdefer php.efree(mem);
            const self: *@This() = @ptrCast(@alignCast(mem));
            self.* = .{};
            const obj = self.object();
            obj.handlers = @ptrCast(getHandlers());
            php.initializeStandardObject(self.object(), class.entry());
            php.initializeObjectProperties(self.object(), class.entry());
            class.addRef();
            return self;
        }

        pub fn setStorage(self: *@This(), bytes: *ByteBuffer, slots: *const Value) !void {
            return try self.zig_portion.setStorage(bytes, slots);
        }

        pub fn isInstance(obj: *Object) bool {
            return obj.handlers == getHandlers();
        }

        fn getHandlers() *ObjectHandlers {
            if (object_handlers == null) {
                object_handlers = init: {
                    var handlers: ObjectHandlers = undefined;
                    handlers.offset = @offsetOf(@This(), "php_portion");
                    inline for (comptime std.meta.fields(@TypeOf(object_handler_mapping))) |field| {
                        const func_name = @field(object_handler_mapping, field.name);
                        @field(handlers, field.name) = if (@hasDecl(S, func_name))
                            php.transform(@field(S, func_name))
                        else if (@hasField(@TypeOf(php.std_object_handlers.*), field.name))
                            @field(php.std_object_handlers, field.name)
                        else
                            null;
                    }
                    break :init handlers;
                };
            }
            return &object_handlers.?;
        }
    };
    if (@offsetOf(Result, "php_portion") + @sizeOf(Object) != @sizeOf(Result))
        @compileError("PHP object is in the wrong position");
    return Result;
}

const object_handler_mapping = .{
    .free_obj = "freeObject",
    .dtor_obj = "destroyObject",
    .clone_obj = "cloneObject",
    .cast_object = "castObject",
    .read_property = "readProperty",
    .write_property = "writeProperty",
    .unset_property = "unsetProperty",
    .has_property = "hasProperty",
    .get_properties = "getProperties",
    .get_properties_for = "getPropertiesFor",
    .get_property_ptr_ptr = "getPropertyPointer",
    .read_dimension = "readElement",
    .write_dimension = "writeElement",
    .unset_dimension = "unsetElement",
    .has_dimension = "hasElement",
    .count_elements = "countElements",
    .get_constructor = "getConstructor",
    .get_method = "getMethod",
    .get_closure = "getClosure",
    .get_class_name = "getClassName",
    .get_debug_info = "getDebugInfo",
    .get_gc = "getReferencedObjects",
    .compare = "compare",
    .do_operation = "doOperation",
};
