pub const ExternStruct = extern struct {
    small_int: i16,
    big_int: i64,
};

pub const RegularStruct = struct {
    small_int: i16,
    big_int: i64,
};

pub const ext_struct: ExternStruct = .{ .small_int = 123, .big_int = 4567890123 };
pub const reg_struct: RegularStruct = .{ .small_int = 123, .big_int = 4567890123 };
