pub const Pet = enum { dog, cat, dragon, kangaroo };
pub const Car = enum { Toyota, Ford, Volkswagen, Tesla, Saab, Fiat, Nissan, Kia };
pub const Computer = enum { Apple, Dell, Lenovo, HP };

pub const Owner = packed struct {
    pet: Pet,
    car: Car,
    computer: Computer,
};
