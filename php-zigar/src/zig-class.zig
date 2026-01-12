const std = @import("std");

const enums = @import("enums.zig");
const StructureType = enums.StructureType;
const StructurePurpose = enums.StructurePurpose;
const StructureFlags = enums.StructureFlags;
const MemberType = enums.MemberType;
const MemberFlags = enums.MemberFlags;
const module_host = @import("module-host.zig");
const Host = module_host.ModuleHost;
const php = @import("php.zig");
const HashTable = php.HashTable;
const HashPosition = php.HashPosition;
const String = php.String;
const Value = php.Value;
const ClassEntry = php.ClassEntry;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const zig_object = @import("zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const ZigClass = struct {
    host: *Host,
    type: StructureType,
    purpose: StructurePurpose,
    flags: StructureFlags,
    instance: Scope = .{},
    static: Scope = .{},
    extra: Extra = undefined,
    php_portion: ClassEntry = undefined,

    var ref_object_handlers: ?ObjectHandlers = null;

    const Scope = struct {
        members: ?HashTable = null,
        template: ?Template = null,
    };
    const Member = struct {
        type: MemberType,
        flags: MemberFlags,
        bit_offset: ?usize,
        bit_size: usize,
        byte_size: ?usize,
        slot: ?usize,
        class: ?*ZigClass,
    };
    const Template = struct {
        bytes: ?*String,
        slots: ?*HashTable,
    };
    const Extra = define: {
        const fields = std.meta.fields(@TypeOf(structure));
        var new_fields: [fields.len]std.builtin.Type.UnionField = undefined;
        for (fields, 0..) |field, i| {
            const Structure = @field(structure, field.name);
            const StructureExtra = if (@hasDecl(Structure, "Extra")) Structure.Extra else void;
            new_fields[i] = .{
                .name = field.name,
                .type = @field(structure, field.name),
                .alignment = @alignOf(StructureExtra),
            };
        }
        break :define @Type(.{
            .@"union" = .{
                .layout = .auto,
                .decls = &.{},
                .fields = &new_fields,
                .tag_type = null,
            },
        });
    };

    pub fn entry(self: *@This()) *ClassEntry {
        return &self.php_portion;
    }

    pub fn fromEntry(ce: *ClassEntry) *@This() {
        return @fieldParentPtr("php_portion", ce);
    }

    pub fn addRef(self: *@This()) void {
        self.php_portion.refcount += 1;
        // std.debug.print("reference class (ref = {d})\n", .{self.php_portion.refcount});
    }

    pub fn release(self: *@This()) void {
        self.php_portion.refcount -= 1;
        // std.debug.print("release class (ref = {d})\n", .{self.php_portion.refcount});
        if (self.php_portion.refcount == 0) {
            // std.debug.print("freeing class\n", .{});
            self.host.release();
            // TODO: clear hash tables
            php.allocator.destroy(self);
        }
    }

    pub fn define(host: *Host, info: *Value) !void {
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{
            .host = host,
            .type = try php.getPropertyWithType(StructureType, info, "type"),
            .purpose = try php.getPropertyWithType(StructurePurpose, info, "purpose"),
            .flags = try php.getPropertyWithType(?StructureFlags, info, "flags") orelse @bitCast(@as(u32, 0)),
            .instance = try extractScope(info, "instance"),
        };
        const ce = &self.php_portion;
        ce.* = .{
            .type = php.USER_CLASS,
            .refcount = 1,
            .name = php.createString("ZigClass"),
            .ce_flags = php.NOT_SERIALIZABLE | php.LINKED,
            .properties_info = php.createHashTable(.none),
            .constants_table = php.createHashTable(.none),
            .function_table = php.createHashTable(.function),
            .info = .{
                .user = .{
                    .filename = php.createString("filename"),
                },
            },
            .unnamed_1 = .{
                .create_object = php.transform(createObject),
            },
        };
        var ref = try createRef(ce);
        try php.setProperty(info, "class", &ref);
        host.addRef();
    }

    pub fn finalize(info: *Value) !void {
        const ref = try php.getProperty(info, "class");
        const obj = try php.getValueObject(ref);
        const self = fromEntry(obj.ce);
        self.static = try extractScope(info, "instance");
    }

    pub fn getExtra(self: *@This(), comptime S: type) @TypeOf(@field(Extra, structureName(S))) {
        return @field(self.extra, structureName(S));
    }

    fn extractScope(info: *Value, name: []const u8) !Scope {
        const scope_info = try php.getProperty(info, name);
        return .{
            .members = try extractMembers(scope_info),
            .template = try extractTemplate(scope_info),
        };
    }

    fn extractMembers(scope_info: *Value) !?HashTable {
        const member_list = php.getProperty(scope_info, "members") catch return null;
        const member_list_ht = try php.getValueHashTable(member_list);
        var pos: HashPosition = undefined;
        var result = php.createHashTable(.none);
        php.initializeHashPosition(member_list_ht, &pos);
        while (php.getHashPositionValue(member_list_ht, &pos)) |member_info| {
            const member_ht = try php.getValueHashTable(member_info);
            var key_str: ?[]const u8 = null;
            var key_int: usize = undefined;
            if (php.getHashEntry(member_ht, "name")) |name| {
                key_str = try php.getValueStringContent(name);
            } else |_| {
                const key = php.getHashPositionKey(member_list_ht, &pos);
                key_int = @intCast(try php.getValueLong(&key));
            }
            const member = try php.allocator.create(Member);
            errdefer php.allocator.destroy(member);
            member.* = .{
                .type = try php.getHashEntryWithType(MemberType, member_ht, "type"),
                .flags = try php.getHashEntryWithType(?MemberFlags, member_ht, "flags") orelse .{},
                .bit_offset = try php.getHashEntryWithType(?usize, member_ht, "bitOffset"),
                .bit_size = try php.getHashEntryWithType(usize, member_ht, "bitSize"),
                .byte_size = try php.getHashEntryWithType(?usize, member_ht, "byteSize"),
                .slot = try php.getHashEntryWithType(?usize, member_ht, "slot"),
                .class = undefined,
            };
            var member_ptr = php.createValuePointer(member);
            if (key_str) |str|
                try php.setHashEntry(&result, str, &member_ptr)
            else
                try php.setHashEntry(&result, key_int, &member_ptr);
            if (!php.moveHashPositionForward(member_list_ht, &pos)) break;
        }
        return result;
    }

    fn extractTemplate(scope_info: *Value) !?Template {
        const template_info = php.getProperty(scope_info, "template") catch return null;
        _ = template_info;
        return null;
    }

    fn createRef(ce: *ClassEntry) !Value {
        const ref = php.createValueObject(ce);
        const obj = php.getValueObject(&ref) catch unreachable;
        if (ref_object_handlers == null) {
            ref_object_handlers = php.std_object_handlers.*;
            const handlers = &ref_object_handlers.?;
            handlers.read_property = php.transform(readProperty);
            handlers.dtor_obj = php.transform(destroyRef);
        }
        obj.handlers = &ref_object_handlers.?;
        return ref;
    }

    fn destroyRef(obj: *Object) void {
        // std.debug.print("freeing class ref\n", .{});
        const self = fromEntry(obj.ce);
        self.release();
    }

    fn getRefHandlers() *ObjectHandlers {
        if (ref_object_handlers == null) {
            const handlers = &ref_object_handlers.?;
            inline for (comptime std.meta.fields(php.object_handler_mapping)) |field| {
                const func_name = @field(php.object_handler_mapping, field.name);
                @field(handlers, field.name) = if (@hasDecl(@This(), func_name))
                    php.transform(@field(@This(), func_name))
                else
                    @field(php.std_object_handlers, field.name);
            }
            handlers.offset = 0;
        }
        return &ref_object_handlers;
    }

    fn createObject(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure, @tagName(t));
                const zig_obj = try ZigObject(S).create(self);
                return zig_obj.object();
            },
        }
    }

    fn structureName(comptime S: type) []const u8 {
        return inline for (comptime std.meta.fields(structure)) |field| {
            if (@field(structure, field.name) == S) break field.name;
        } else @compileError("Recognized structure type: " ++ @typeName(S));
    }

    fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: *?*anyopaque, retval: *Value) !*Value {
        _ = obj;
        _ = name;
        _ = prop_type;
        _ = cache_slot;
        retval.* = php.createValueLong(456);
        return retval;
    }
};

const structure = .{
    .primitive = @import("structure/primitive.zig").Primitive,
    .array = @import("structure/array.zig").Array,
    .@"struct" = @import("structure/struct.zig").Struct,
    .@"union" = @import("structure/union.zig").Union,
    .error_union = @import("structure/error-union.zig").ErrorUnion,
    .error_set = @import("structure/error-set.zig").ErrorSet,
    .@"enum" = @import("structure/enum.zig").Enum,
    .optional = @import("structure/optional.zig").Optional,
    .pointer = @import("structure/pointer.zig").Pointer,
    .slice = @import("structure/slice.zig").Slice,
    .vector = @import("structure/vector.zig").Vector,
    .@"opaque" = @import("structure/opaque.zig").Opaque,
    .arg_struct = @import("structure/arg-struct.zig").ArgStruct,
    .variadic_struct = @import("structure/variadic-struct.zig").VariadicStruct,
    .function = @import("structure/function.zig").Function,
};
