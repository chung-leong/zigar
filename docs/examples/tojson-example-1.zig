const JediError = error{ fell_to_the_dark_side, lightsaber_low_battery };
const JediStruct = struct {
    age: u64 = 72,
    err: JediError = JediError.fell_to_the_dark_side,
};
pub const jedi: JediStruct = .{};
