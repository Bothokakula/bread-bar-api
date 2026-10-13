const bcrypt = require('bcryptjs');
const env = require('../config/env');

// Compared against when an email does not exist, so a "no such user" login
// takes as long as a "wrong password" login (stops account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('breadbar-dummy-password', env.bcryptRounds);

const hashSecret = (plain) => bcrypt.hash(plain, env.bcryptRounds);
const compareSecret = (plain, hash) => bcrypt.compare(plain, hash || DUMMY_HASH);

module.exports = { hashSecret, compareSecret };
