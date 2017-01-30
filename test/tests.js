'use strict';

const fs = require('fs');
const Web3 = require('web3');
const TestRPC = require('ethereumjs-testrpc');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BSToken = require('bs-token');
const Deployer = require('contract-deployer');

chai.use(chaiAsPromised);
chai.should();

const provider = TestRPC.provider({
    accounts: [{
        index: 0,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db80',
        balance: 200000000
    }]
});

const web3 = new Web3(provider);

describe('Deployer', function () {

    const account1 = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const testContracts = Object.assign(BSToken.contracts, {
        'BSBanking.sol': fs.readFileSync('./contracts/BSBanking.sol', 'utf8'),
    });

    it('should deploy contracts correctly', function () {
        const deployer = new Deployer(web3, {sources: testContracts}, 0);
        return deployer.deploy('BSTokenData', [], { from: account1, gas: 4000000 })
            .then(bsTokenData => {
                return deployer.deploy('BSBanking', [bsTokenData.address], { from: account1, gas: 4000000 });
            });
    }).timeout(40000);

});
