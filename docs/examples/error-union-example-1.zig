const MathError = error{NegativeNumber};

pub fn getSquareRoot(number: f64) MathError!f64 {
    if (number < 0) {
        return MathError.NegativeNumber;
    }
    return @sqrt(number);
}
