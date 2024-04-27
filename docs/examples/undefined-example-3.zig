pub const NumberAndUnknown = struct {
    number: i32,
    comptime unknown: @TypeOf(undefined) = undefined,
};
