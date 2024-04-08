pub const FileOpenError = error{
    access_denied,
    out_of_memory,
    file_not_found,
};

pub const HumanError = error{
    got_into_crypto_currencies,
    ran_out_of_beer,
    did_not_know_how_to_use_a_condom,
    hung_out_with_clifford_banes,
};

pub const AnyError = anyerror;
