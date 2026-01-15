const std = @import("std");

const accessor = @import("accessor.zig");
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
const Function = php.Function;
const HashPosition = php.HashPosition;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const ObjectHandlers = php.ObjectHandlers;
const structure = @import("structure.zig");
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
    finalized: bool = false,
    static_data: StaticData = undefined,
    php_portion: ClassEntry = undefined,

    pub const ScopeType = enum { instance, static };

    const Scope = struct {
        members: HashTable = undefined,
        template: Template = undefined,

        fn release(self: *@This()) void {
            php.destroyHashTable(&self.members);
            self.template.release();
        }
    };
    pub const Member = struct {
        type: MemberType,
        flags: MemberFlags,
        bit_offset: ?usize,
        bit_size: usize,
        byte_size: ?usize,
        slot: ?usize,
        class: ?*ZigClass,
        accessors: accessor.Any = undefined,

        pub fn destructor(value: [*c]Value) callconv(.c) void {
            const member = php.getValuePointer(*Member, value) catch unreachable;
            if (member.class) |c| c.release();
            php.allocator.destroy(member);
        }
    };
    pub const Template = struct {
        bytes: ?*ByteBuffer = null,
        slots: ?*HashTable = null,

        fn release(self: *@This()) void {
            if (self.bytes) |b| b.release();
            if (self.slots) |s| php.release(s);
        }
    };
    const StaticData = define: {
        const fields = std.meta.fields(@TypeOf(structure.by_enum));
        var new_fields: [fields.len]std.builtin.Type.UnionField = undefined;
        for (fields, 0..) |field, i| {
            const Structure = @field(structure.by_enum, field.name);
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
            if (self.finalized) {
                self.static.release();
                self.instance.release();
            }
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
        errdefer self.instance.release();
        self.static = try self.extractScope(info, "static");
        errdefer self.static.release();
        // initialize static data
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
        // set fields of ref object
        const static = structure.Static.fromObject(obj);
        try static.setFields(&self.static.members, self.static.template.slots);
        // attach accessors to instance members
        const members = &self.instance.members;
        var pos: php.HashPosition = undefined;
        php.initializeHashPosition(members, &pos);
        while (try php.getHashPositionPointer(*ZigClass.Member, members, &pos)) |member| {
            member.accessors = getAccessors(member);
            if (!php.moveHashPositionForward(members, &pos)) break;
        }
        self.finalized = true;
    }

    pub fn createInstance(info: *Value, memory: *Value, slots: ?*Value) !Value {
        const ref = try php.getProperty(info, "class");
        const obj = try php.getValueObject(ref);
        const new = try createObjectWith(obj.ce, memory, slots);
        return php.createValueObject(new);
    }

    pub fn getFlags(self: *@This(), comptime S: type) @FieldType(StructureFlags, structure.enumName(S)) {
        return @field(self.flags, structure.enumName(S));
    }

    pub fn getStaticData(self: *@This(), comptime S: type) @FieldType(StaticData, structure.enumName(S)) {
        return @field(self.static_data, structure.enumName(S));
    }

    pub fn getMember(self: *@This(), comptime scope: ScopeType, key: anytype) !*Member {
        switch (scope) {
            inline else => |s| {
                const container = @field(self, @tagName(s));
                const ht = container.members orelse return error.Missing;
                const value = try php.getHashEntry(ht, key);
                return try php.getValuePointer(*Member, value);
            },
        }
    }

    fn extractScope(self: *@This(), info: *Value, name: []const u8) !Scope {
        const scope_info = try php.getProperty(info, name);
        var members = try self.extractMembers(scope_info);
        errdefer php.destroyHashTable(&members);
        const template = try self.extractTemplate(scope_info);
        return .{ .members = members, .template = template };
    }

    fn extractMembers(self: *@This(), scope_info: *Value) !HashTable {
        var result = php.createHashTable(Member.destructor);
        if (php.getProperty(scope_info, "members")) |member_list| {
            const member_list_ht = try php.getValueHashTable(member_list);
            var pos: HashPosition = undefined;
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
                    .bit_size = try php.getHashEntryWithType(?usize, member_ht, "bitSize") orelse 0,
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
        } else |_| {}
        return result;
    }

    fn extractTemplate(_: *@This(), scope_info: *Value) !Template {
        if (php.getProperty(scope_info, "template")) |template_info| {
            const memory = php.getProperty(template_info, "memory") catch null;
            const objects = php.getProperty(template_info, "slots") catch null;
            const bytes = try extractBytes(memory);
            errdefer if (bytes) |b| b.release();
            const slots = try extractSlots(objects);
            return .{ .bytes = bytes, .slots = slots };
        } else |_| {
            return .{ .bytes = null, .slots = null };
        }
    }

    fn extractBytes(memory: ?*Value) !?*ByteBuffer {
        const value = memory orelse return null;
        const buf = try php.getValuePointer(*ByteBuffer, value);
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
        const zig_obj = try ZigObject(structure.Static).create(self, undefined, undefined);
        self.release(); // remove initial refcount now that the ref object exists
        return php.createValueObject(zig_obj.object());
    }

    fn createObject(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const flags = @field(self.flags, @tagName(t));
                const bytes = create: {
                    const byte_size = if (self.type != .variadic_struct) self.byte_size else null;
                    const len = byte_size orelse break :create undefined;
                    break :create if (self.instance.template.bytes) |buffer|
                        try buffer.duplicate()
                    else
                        try ByteBuffer.createNew(len, self.alignment);
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
                const S = @field(structure.by_enum, @tagName(t));
                const bytes = try extractBytes(memory);
                errdefer if (bytes) |b| b.release();
                const slots = try extractSlots(objects);
                const zig_obj = try ZigObject(S).create(self, bytes.?, slots);
                return zig_obj.object();
            },
        }
    }

    fn getAccessors(member: *Member) accessor.Any {
        @setEvalBranchQuota(2000000);
        switch (member.type) {
            .int, .uint => inline for (0..65) |bits| {
                if (member.bit_size == bits) {
                    inline for (.{ .signed, .unsigned }) |signedness| {
                        if ((member.type == .int) == (signedness == .signed)) {
                            if (member.bit_offset) |bit_offset| {
                                // when byte_size is given, then field is byte-aligned
                                const bit_offset_mod8: ?u3 = if (member.byte_size != null) null else @intCast(bit_offset % 8);
                                inline for (.{ null, 0, 1, 2, 3, 4, 5, 6, 7 }) |offset| {
                                    if (bit_offset_mod8 == offset) {
                                        const primitive = accessor.int.get(.{
                                            .signedness = signedness,
                                            .bit_size = bits,
                                            .bit_offset = offset,
                                        });
                                        return .{ .primitive = primitive };
                                    }
                                }
                            } else {
                                const T = @Type(.{
                                    .int = .{
                                        .signedness = signedness,
                                        .bits = bits,
                                    },
                                });
                                const vector = accessor.vector.get(.{
                                    .child = T,
                                    .is_packed = false,
                                });
                                return .{ .vector = vector };
                            }
                        }
                    }
                    break;
                }
            },
            else => {},
        }
        return undefined;
    }
};
