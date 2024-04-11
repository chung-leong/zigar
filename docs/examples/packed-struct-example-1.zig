pub const PackedStruct = packed struct {
    state_a: bool = false,
    state_b: bool = true,
    state_c: bool = false,
    state_d: bool = false,
    state_e: bool = false,
    state_f: bool = false,
    state_g: bool = false,
};

pub const RegularStruct = struct {
    state_a: bool = false,
    state_b: bool = true,
    state_c: bool = false,
    state_d: bool = false,
    state_e: bool = false,
    state_f: bool = false,
    state_g: bool = false,
};

pub const pac_struct: PackedStruct = .{};
pub const reg_struct: RegularStruct = .{};
