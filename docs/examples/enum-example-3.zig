pub const Pet = enum(u2) { dog, cat, dragon, kangaroo };
pub const Car = enum(u3) { Toyota, Ford, Volkswagen, Tesla, Saab, Fiat, Nissan, Kia };
pub const Computer = enum(u2) { Apple, Dell, Lenovo, HP };

pub const Owner = packed struct {
    pet: Pet,
    car: Car,
    computer: Computer,
};
