'use strict';

const fs = require('fs');
const Web3 = require('web3');
const provider = require('./mock-web3-provider');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const GTPermissionManager = require('gt-permission-manager');
const BSTokenData = require('bs-token-data');
const BSTokenBanking = require('../src/index');
const BigNumber = require('bignumber.js');
const gas = 4000000;

chai.use(chaiAsPromised);
chai.should();

describe('BSTokenBanking lib', function () {
    const account1 = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const account2 = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const account3 = '0x6128333118cef876bd620da1efa464437470298d';

    const fakeBankAccount = '1111 2222 33 4444444444';
    const web3 = new Web3(provider);

    let permissionManager;
    let bsTokenDataContract;
    let bsTokenBankingContract;
    let lib;

    before('Deploy contracts', function () {
        this.timeout(60000);

        return GTPermissionManager.deployedContract(web3, account1, gas)
            .then((contract) => permissionManager = contract)
            .then(() => BSTokenData.deployedContract(web3, account1, permissionManager, gas))
            .then(contract => {
                bsTokenDataContract = contract;
                return BSTokenBanking.deployedContract(web3, account1, bsTokenDataContract, permissionManager, gas);
            })
            .then((contract) => bsTokenBankingContract = contract)
            .then(() => bsTokenDataContract.addLogicAsync(account3, { from: account1, gas: gas }))
            .then(() => {
                lib = new BSTokenBanking(web3, {
                    admin: { account: account1, password: ''},
                    bsTokenDataContract: bsTokenDataContract,
                    bsTokenBankingContract: bsTokenBankingContract,
                    sendgrid: {
                        apiKey: ''
                    }
                });
            });
    });

    it('should increase account balance after cash in', function () {
        return lib.cashIn(account2, 100, { from: account1 })
            .then(() => bsTokenDataContract.getBalanceAsync(account2))
            .should.eventually.satisfy(balance => balance.equals(new BigNumber(100)),
                `Token balance of ${account2} should be 100 after 100€ cash in`);
    });

    it('should decrease account balance after cash out', function () {
        return lib.cashOut(account2, '', 100, fakeBankAccount)
            .then(() => bsTokenDataContract.getBalanceAsync(account2))
            .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)),
                `Token balance of ${account2} should be 0 after 100€ cash out`);
    });

    it('should increase total token supply after cash in', function () {
        return lib.cashIn(account2, 700, { from: account1 })
            .then(() => bsTokenDataContract.getTotalSupplyAsync())
            .should.eventually.satisfy(totalSupply => totalSupply.equals(new BigNumber(700)),
                `Total token supply should be 700 after 700€ cash in`);
    });

    it('should decrease total token supply after cash out', function () {
        return lib.cashOut(account2, '', 500, fakeBankAccount)
            .then(() => bsTokenDataContract.getTotalSupplyAsync())
            .should.eventually.satisfy(totalSupply => totalSupply.equals(new BigNumber(200)),
                `Total token supply should be 200 after 500€ cash in`);
    });

    it('should fail if cash out amount greater than account balance', function () {
            return lib.cashOut(account2, '', 201, fakeBankAccount)
                .should.eventually.be.rejectedWith(`${account2} address has not enough funds`);
    });

    it('should fail if cash in is not performed by the contract owner', function () {
        return lib.cashIn(account2, 700, { from: account2 });
    });

/*    it('should launch CashOut even after cash out', function () {
        return lib.cashIn(account2, 500, { from: account1 })
            .then(() => lib.cashOut(account2, '', 500, fakeBankAccount))
            .then(() => lib.cashOut(account2, '', 500, ''))
            .should.eventually.satisfy(event => {
                return event.args.amount.equals(new BigNumber(500)) &&
                    event.args.bankAccount === fakeBankAccount &&
                    event.args.receiver === account2;
            }, 'invalid CashOut event');
    }).timeout(40000);*/
});
