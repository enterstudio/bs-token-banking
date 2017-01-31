const fs = require("fs");
const path = require("path");

module.exports.contracts = {
    'BSBanking.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSBanking.sol'), 'utf8')
};