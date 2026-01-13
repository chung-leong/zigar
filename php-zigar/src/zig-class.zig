const std = @import("std");

const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const enums = @import("enums.zig");
const MemberFlags = enums.MemberFlags;
const MemberType = enums.MemberType;
const StructureFlags = enums.StructureFlags;
const StructurePurpose = enums.StructurePurpose;
const StructureType = enums.StructureType;
const module_host = @import("module-host.zig");
const Host = module_host.ModuleHost;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashPosition = php.HashPosition;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const ObjectHandlers = php.ObjectHandlers;
const zig_object = @import("zig-object.zig");
const ZigObject = zig_object.ZigObject;
const ZigObjectInit = zig_object.ZigObjectInit;

pub const ZigClass = struct {
    host: *Host,
    type: StructureType,
    purpose: StructurePurpose,
    flags: StructureFlags,
    alignment: usize,
    signature: u64,
    length: ?usize,
    byte_size: ?usize,
    instance: Scope = .{},
    static: Scope = .{},
    static_data: StaticData = undefined,
    php_portion: ClassEntry = undefined,

    pub const ScopeType = enum { instance, static };

    const Scope = struct {
        members: ?HashTable = null,
        template: ?Template = null,

        fn release(self: *@This()) void {
            if (self.members) |*ht| php.destroyHashTable(ht);
            if (self.template) |*t| t.release();
        }
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
        bytes: ?*ByteBuffer = null,
        slots: ?*HashTable = null,

        fn release(self: *@This()) void {
            if (self.bytes) |b| b.release();
            if (self.slots) |s| php.release(s);
        }
    };
    const StaticData = define: {
        const fields = std.meta.fields(@TypeOf(structure));
        var new_fields: [fields.len]std.builtin.Type.UnionField = undefined;
        for (fields, 0..) |field, i| {
            const Structure = @field(structure, field.name);
            const StructureStatic = if (@hasDecl(Structure, "Static")) Structure.Static else void;
            new_fields[i] = .{
                .name = field.name,
                .type = StructureStatic,
                .alignment = @alignOf(StructureStatic),
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

    pub fn fromObject(obj: *Object) *@This() {
        return fromEntry(obj.ce);
    }

    pub fn fromStructure(s: anytype) *@This() {
        const S = @TypeOf(s.*);
        const zig_obj = ZigObject(S).fromStructure(s);
        return fromEntry(zig_obj.php_portion.ce);
    }

    pub fn addRef(self: *@This()) void {
        self.php_portion.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        self.php_portion.refcount -= 1;
        // std.debug.print("release class {x} (ref = {d})\n", .{ @intFromPtr(self), self.php_portion.refcount });
        if (self.php_portion.refcount == 0) {
            // std.debug.print("freeing class\n", .{});
            self.host.release();
            self.static.release();
            self.instance.release();
            const ce = self.entry();
            php.release(ce.name);
            php.release(ce.info.user.filename);
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
            .alignment = try php.getPropertyWithType(usize, info, "align"),
            .length = try php.getPropertyWithType(?usize, info, "length"),
            .byte_size = try php.getPropertyWithType(?usize, info, "byteSize"),
            .signature = get: {
                const sig = try php.getProperty(info, "signature");
                if (php.getValueDouble(sig)) |d|
                    break :get @intFromFloat(d)
                else |_| if (php.getValueLong(sig)) |l|
                    break :get @intCast(l)
                else |_|
                    return error.InvalidSignature;
            },
        };
        const ce = &self.php_portion;
        ce.* = .{
            .type = php.USER_CLASS,
            .refcount = 1,
            .name = php.createString("ZigClass"),
            .ce_flags = php.NOT_SERIALIZABLE | php.LINKED,
            .properties_info = php.createHashTable(null),
            .constants_table = php.createHashTable(null),
            .function_table = php.createHashTable(php.destructor.function),
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
        self.instance = try self.extractScope(info, "instance");
        self.static = try self.extractScope(info, "instance");
        switch (self.type) {
            inline else => |t| {
                const name = @tagName(t);
                if (@FieldType(StaticData, name) != void) {
                    self.static_data = @unionInit(StaticData, name, .{});
                    const data = &@field(self.static_data, name);
                    try data.initialize(self);
                }
            },
        }
    }

    pub fn createInstance(info: *Value, memory: *Value, slots: ?*Value) !Value {
        const ref = try php.getProperty(info, "class");
        const obj = try php.getValueObject(ref);
        const new = try createObjectWith(obj.ce, memory, slots);
        return php.createValueObject(new);
    }

    pub fn getFlags(self: *@This(), comptime S: type) @FieldType(StructureFlags, structureName(S)) {
        return @field(self.flags, structureName(S));
    }

    pub fn getStaticData(self: *@This(), comptime S: type) @FieldType(StaticData, structureName(S)) {
        return @field(self.static_data, structureName(S));
    }

    pub fn getMember(self: *@This(), comptime scope: ScopeType, key: anytype) !*Member {
        switch (scope) {
            inline else => |s| {
                const container = @field(self, @tagName(s));
                const ht = container.members orelse return error.Missing;
                const value = try php.getHashEntry(ht, key);
                return try php.getValuePointerWithType(*Member, value);
            },
        }
    }

    pub fn getTemplate(self: *@This(), comptime scope: ScopeType) !Template {
        switch (scope) {
            inline else => |s| {
                const container = @field(self, @tagName(s));
                return container.template orelse return error.Missing;
            },
        }
    }

    fn extractScope(self: *@This(), info: *Value, name: []const u8) !Scope {
        const scope_info = try php.getProperty(info, name);
        return .{
            .members = try self.extractMembers(scope_info),
            .template = try self.extractTemplate(scope_info),
        };
    }

    fn extractMembers(self: *@This(), scope_info: *Value) !?HashTable {
        const member_list = php.getProperty(scope_info, "members") catch return null;
        const member_list_ht = try php.getValueHashTable(member_list);
        var pos: HashPosition = undefined;
        var result = php.createHashTable(member_destructor);
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
                .class = get: {
                    const struct_info = php.getHashEntry(member_ht, "structure") catch break :get null;
                    const ref = try php.getProperty(struct_info, "class");
                    const obj = try php.getValueObject(ref);
                    const class = fromEntry(obj.ce);
                    if (class != self) class.addRef();
                    break :get class;
                },
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

    fn extractTemplate(_: *@This(), scope_info: *Value) !?Template {
        const template_info = php.getProperty(scope_info, "template") catch return null;
        const memory = php.getProperty(template_info, "memory") catch null;
        const objects = php.getProperty(template_info, "slots") catch null;
        const bytes = try extractBytes(memory);
        errdefer if (bytes) |b| b.release();
        const slots = try extractSlots(objects);
        return .{ .bytes = bytes, .slots = slots };
    }

    fn extractBytes(memory: ?*Value) !?*ByteBuffer {
        const value = memory orelse return null;
        const ptr = try php.getValuePointer(value);
        const buf: *ByteBuffer = @ptrCast(@alignCast(ptr));
        buf.addRef();
        return buf;
    }

    fn extractSlots(slots: ?*Value) !?*HashTable {
        const value = slots orelse return null;
        const ht = try php.getValueHashTable(value);
        php.addRef(ht);
        return ht;
    }

    fn createRef(ce: *ClassEntry) !Value {
        const self = fromEntry(ce);
        const zig_obj = try ZigObject(Static).create(self, undefined, undefined);
        self.release(); // remove initial refcount now that the ref object exists
        return php.createValueObject(zig_obj.object());
    }

    fn createObject(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure, @tagName(t));
                const flags = @field(self.flags, @tagName(t));
                const bytes = create: {
                    const byte_size = if (self.type != .variadic_struct) self.byte_size else null;
                    const len = byte_size orelse break :create undefined;
                    if (self.instance.template) |tpl| {
                        if (tpl.bytes) |b| break :create try b.duplicate();
                    }
                    const buffer = try ByteBuffer.createNew(len, self.alignment);
                    break :create buffer;
                };
                errdefer bytes.release();
                const slots = create: {
                    if (!flags.has_slot) break :create null;
                    const ht = php.createArray();
                    break :create ht;
                };
                const zig_obj = try ZigObject(S).create(self, bytes, slots);
                return zig_obj.object();
            },
        }
    }

    fn createObjectWith(ce: *ClassEntry, memory: *Value, objects: ?*Value) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure, @tagName(t));
                const bytes = try extractBytes(memory);
                errdefer if (bytes) |b| b.release();
                const slots = try extractSlots(objects);
                const zig_obj = try ZigObject(S).create(self, bytes.?, slots);
                return zig_obj.object();
            },
        }
    }

    fn structureName(comptime S: type) []const u8 {
        return inline for (comptime std.meta.fields(@TypeOf(structure))) |field| {
            if (@field(structure, field.name) == S) break field.name;
        } else @compileError("Recognized structure type: " ++ @typeName(S));
    }

    fn member_destructor(value: [*c]Value) callconv(.c) void {
        const ptr = php.getValuePointer(value) catch unreachable;
        const member: *Member = @ptrCast(@alignCast(ptr));
        if (member.class) |c| c.release();
        php.allocator.destroy(member);
    }
};

pub const Static = struct {
    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: *?*anyopaque, retval: *Value) !*Value {
        _ = obj;
        _ = name;
        _ = prop_type;
        _ = cache_slot;
        retval.* = php.createValueLong(456);
        return retval;
    }

    pub fn setStorage(_: *@This(), _: *ByteBuffer, _: ?*HashTable) !void {}

    pub fn freeObject(obj: *Object) void {
        // std.debug.print("freeing class ref\n", .{});
        const class = ZigClass.fromEntry(obj.ce);
        class.release();
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
