const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const HashPosition = php.HashPosition;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Union = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        selector: ?struct {
            accessors: *accessor.Primitive,
            class: *ZigClass,
        } = null,

        pub fn init(self: *@This(), class: *ZigClass) !void {
            const member = find: {
                if (true) break :find null;
                var pos: HashPosition = undefined;
                const ht = &class.instance.members;
                php.initializeHashPosition(ht, &pos);
                while (php.getHashPositionValue(ht, &pos)) |value| {
                    const member = try php.getValuePointer(*ZigClass.Member, value);
                    if (member.flags.is_selector) break :find member;
                    if (!php.moveHashPositionForward(ht, &pos)) break;
                }
                break :find null;
            };
            if (member) |m| {
                if (m.accessors != .primitive) return error.InvalidAccessor;
                const selector_class = m.class orelse return error.MissingClass;
                self.selector = .{
                    .accessors = &m.accessors.primitive,
                    .class = selector_class,
                };
            }
        }
    };

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        if (checkSelector(obj, name)) {
            return Super.readProperty(obj, name, prop_type, cache_slot, retval);
        } else |err| {
            php.throwError(err);
            return retval;
        }
    }

    fn checkSelector(obj: *Object, name: *String) !void {
        _ = name;
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        if (static.selector) |selector| {
            const value = try selector.accessors.get(self.bytes);
            if (php.getValueLong(&value)) |long| {
                _ = long;
                // std.debug.print("long = {d}\n", .{long});
            } else |_| {}
        }
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
};
