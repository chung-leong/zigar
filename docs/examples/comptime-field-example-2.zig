pub const DataSection = struct {
    comptime type: @TypeOf(.enum_literal) = .data,
    offset: i64,
    len: i64,
};
