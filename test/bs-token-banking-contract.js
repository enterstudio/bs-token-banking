'use strict';

const fs = require('fs');
const Web3 = require('web3');
const TestRPC = require('ethereumjs-testrpc');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const GTPermissionManager = require('gt-permission-manager');
const BSTokenData = require('bs-token-data');
const BSTokenBanking = require('../src/index');
const BigNumber = require('bignumber.js');
const gas = 4000000;

chai.use(chaiAsPromised);
chai.should();

describe('BSTokenBanking contract', function () {
    const account1 = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const account2 = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const account3 = '0x6128333118cef876bd620da1efa464437470298d';

    const fakeBankAccount = '1111 2222 33 4444444444';

    const web3 = new Web3(TestRPC.provider({
        accounts: [{
            index: 0,
            secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db80',
            balance: 200000000
        }, {
            index: 1,
            secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db81',
            balance: 200000000
        }, {
            index: 2,
            balance: 200000000,
            secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db82'
        }]
    }));

    let permissionManager;
    let bsTokenDataContract;
    let bsTokenBankingContract;

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
            .then(() => bsTokenDataContract.addLogicAsync(account3, { from: account1, gas: gas }));
    });

    it('should reference BSTokenData contract', function () {
        return bsTokenBankingContract.tokenDataAsync().should.eventually.equal(bsTokenDataContract.address);
    });

    it('should increase account balance after cash in', function () {
        return bsTokenBankingContract.cashInAsync(account2, 100, { from: account1, gas: gas })
            .then(() => bsTokenDataContract.getBalanceAsync(account2))
            .should.eventually.satisfy(balance => balance.equals(new BigNumber(100)),
                `Token balance of ${account2} should be 100 after 100€ cash in`);
    });

    it('should decrease account balance after cash out', function () {
        return bsTokenBankingContract.cashOutAsync(100, fakeBankAccount, { from: account2, gas: gas })
            .then(() => bsTokenDataContract.getBalanceAsync(account2))
            .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)),
                `Token balance of ${account2} should be 0 after 100€ cash out`);
    });

    it('should increase total token supply after cash in', function () {
        return bsTokenBankingContract.cashInAsync(account2, 700, { from: account1, gas: gas })
            .then(() => bsTokenDataContract.getTotalSupplyAsync())
            .should.eventually.satisfy(totalSupply => totalSupply.equals(new BigNumber(700)),
                `Total token supply should be 700 after 700€ cash in`);
    });

    it('should decrease total token supply after cash out', function () {
        return bsTokenBankingContract.cashOutAsync(500, fakeBankAccount, { from: account2, gas: gas })
            .then(() => bsTokenDataContract.getTotalSupplyAsync())
            .should.eventually.satisfy(totalSupply => totalSupply.equals(new BigNumber(200)),
                `Total token supply should be 200 after 500€ cash in`);
    });

    it('should fail if cash out amount greater than account balance', function () {
            return bsTokenBankingContract.cashOutAsync(201, fakeBankAccount, { from: account2, gas: gas })
            .should.be.rejected;
    });

    it('should fail if cash in is not performed by the contract owner', function () {
        return bsTokenBankingContract.cashInAsync(account2, 100, { from: account2, gas: gas })
            .should.be.rejected;
    });

    it('should launch CashOut even after cash out', function () {
        return bsTokenBankingContract.cashInAsync(account2, 500, { from: account1, gas: gas })
            .then(() => bsTokenBankingContract.cashOutAsync(500, fakeBankAccount, { from: account2, gas: gas }))
            .then(() => bsTokenBankingContract.CashOutAsync())
            .should.eventually.satisfy(event => {
                return event.args.amount.equals(new BigNumber(500)) &&
                    event.args.bankAccount === fakeBankAccount &&
                    event.args.receiver === account2;
            }, 'invalid CashOut event');
    }).timeout(40000);

    describe('transferOwnership', () => {
        it('add admin as non admin', () => {
            return permissionManager.setRolAsync(account2, 1, {
                from: account2,
                gas: gas
            }).should.eventually.be.rejected;
        });

        it('check admin status', () => {
            return permissionManager.getRolAsync(account2)
                .should.eventually.satisfy(rol => rol.equals(new BigNumber(0)), `rol should be 0`);
        });

        it('cashInAsync should be rejected', () => {
            return bsTokenBankingContract.cashInAsync(account3, 100, { from: account2, gas: gas })
                .should.be.rejected;
        });

        it('check balanceOf', () => {
            return bsTokenDataContract.getBalanceAsync(account3)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)),
                    `Token balance of ${account3} should be 0 after`);
        });

        it('add account2 as admin', () => {
            return permissionManager.setRolAsync(account2, 1, {
                from: account1,
                gas: gas
            });
        });

        it('check admin status', () => {
            return permissionManager.getRolAsync(account2)
                .should.eventually.satisfy(rol => rol.equals(new BigNumber(1)), `rol should be 1`);
        });

        it('cashInAsync should be fulfilled', () => {
            return bsTokenBankingContract.cashInAsync(account3, 100, { from: account2, gas: gas })
        });

        it('check balanceOf', () => {
            return bsTokenDataContract.getBalanceAsync(account3)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(100)),
                    `Token balance of ${account3} should be 100 after`);
        });
    });
});
