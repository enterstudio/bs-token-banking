'use strict';

const Deployer = require('contract-deployer');
const BSTokenData = require('bs-token-data');
const fs = require("fs");
const path = require("path");

module.exports.contracts = {
    'BSBanking.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSBanking.sol'), 'utf8')
};

exports.deployedContract = function (web3, admin, bsTokenData, gas) {
    const contracts =  Object.assign(BSTokenData.contracts, exports.contracts);
    const deployer = new Deployer(web3, {sources: contracts}, 0);
    return deployer.deploy('BSBanking', [bsTokenData.address], { from: admin, gas: gas })
        .then(bsTokenBanking => {
            return bsTokenData.addMerchantAsync(bsTokenBanking.address, { from: admin, gas: gas })
                .then(() => bsTokenBanking);
        });
};