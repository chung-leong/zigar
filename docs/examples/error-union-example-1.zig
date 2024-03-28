const MathError = error{negative_number};

pub fn getSquareRoot(number: f64) MathError!f64 {
    if (number < 0) {
        return MathError.negative_number;
    }
    return @sqrt(number);
}
