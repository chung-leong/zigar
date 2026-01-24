const std = @import("std");

const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const zig_class = @import("zig-class.zig");
const ZigClass = zig_class.ZigClass;

pub fn ZigObject(comptime S: type) type {
    const Result = struct {
        zig_portion: S = .{},
        php_portion: php.Object = .{},

        var object_handlers: ?ObjectHandlers = null;

        pub fn object(self: *@This()) *Object {
            return &self.php_portion;
        }

        pub fn fromObject(obj: *Object) *@This() {
            return @fieldParentPtr("php_portion", obj);
        }

        pub fn fromStructure(s: *S) *@This() {
            return @alignCast(@fieldParentPtr("zig_portion", s));
        }

        pub fn create(class: *ZigClass) !*@This() {
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

pub fn callHandler(obj: *Object, comptime name: []const u8, args: anytype) !RT: {
    const Optional = @FieldType(ObjectHandlers, name);
    const Pointer = @typeInfo(Optional).optional.child;
    const Handler = @typeInfo(Pointer).pointer.child;
    break :RT @typeInfo(Handler).@"fn".return_type.?;
} {
    const handlers: *const ObjectHandlers = @ptrCast(obj.handlers);
    const handler = @field(handlers, name) orelse return error.Unexpected;
    return @call(.auto, handler, .{obj} ++ args);
}

pub const ObjectHandlers = define: {
    const php_handlers = php.ObjectHandlers;
    const zig_handlers = struct {
        read_self: ?*const fn ([*c]Object) callconv(.c) Value,
        write_self: ?*const fn ([*c]Object, [*c]const Value) callconv(.c) void,
        get_string: ?*const fn ([*c]Object) callconv(.c) Value,
        get_plain: ?*const fn ([*c]Object) callconv(.c) Value,
        stringify: ?*const fn ([*c]Object) callconv(.c) Value,
    };
    const php_fields = std.meta.fields(php_handlers);
    const zig_fields = std.meta.fields(zig_handlers);
    var combined_fields: [php_fields.len + zig_fields.len]std.builtin.Type.StructField = undefined;
    for (php_fields, 0..) |field, i| combined_fields[i] = field;
    for (zig_fields, 0..) |field, i| combined_fields[php_fields.len + i] = field;
    break :define @Type(.{
        .@"struct" = .{
            .layout = .@"extern",
            .decls = &.{},
            .fields = &combined_fields,
            .is_tuple = false,
        },
    });
};

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
    // zigar specific handlers
    .read_self = "readSelf",
    .write_self = "writeSelf",
    .get_string = "getString",
    .get_plain = "getPlain",
    .stringify = "stringify",
};
