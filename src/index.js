'use strict';

const Deployer = require('contract-deployer');
const BSTokenData = require('bs-token-data');
const sendgrid = require('sendgrid');
const fs = require("fs");
const path = require("path");
const Promise = require('bluebird');

const gas = 3000000;

class BSTokenBanking {
    constructor(web3, config) {
        this.config = config;
        this.web3 = web3;
        this.contract = config.bsTokenBankingContract;
        this.bsTokenDataContract = config.bsTokenDataContract;

        Promise.promisifyAll(this.web3.personal);
        Promise.promisifyAll(this.web3.eth);
        Promise.promisifyAll(this.contract);

        this.contract.CashOutAsync().
            then(result => {
                this.sendCashOutEmail(result.args.receiver, result.args.amount, result.args.bankAccount);
            });
    }

    unlockAdminAccount() {
        return this.web3.personal.unlockAccountAsync(
            this.config.admin.account,
            this.config.admin.password
        );
    }

    unlockAccount(account, password) {
        return this.web3.personal.unlockAccountAsync(account, password);
    }

    cashIn(target, amount) {
        return this.unlockAdminAccount()
            .then(() => this.contract.cashInAsync(target, amount, { from : this.config.admin.account, gas: gas }))
            .then(tx => ({ tx }));
    }

    cashOut(target, password, amount, bankAccount) {
        return this.unlockAccount(target, password)
            .then(() => this.bsTokenDataContract.getBalanceAsync(target))
            .then((balance) => {
                if (balance < amount) {
                    throw new Error(`${target} address has not enough funds`);
                }
            })
            .then(() => this.contract.cashOutAsync(amount, bankAccount, { from: target, gas: gas }))
            .then(tx => ({ tx }));
    }

    sendCashOutEmail(target, cashOutAmount, bankAccount) {
        const helper = sendgrid.mail;
        const fromEmail = new helper.Email(this.config.fromEmail);
        const toEmail = new helper.Email(this.config.toEmail);
        const subject = `Cash out request from ${target}`;
        const content = new helper.Content('text/plain', `Amount: ${cashOutAmount} Bank Account: ${bankAccount} Address: ${target}`);
        const mail = new helper.Mail(fromEmail, subject, toEmail, content);

        const sg = sendgrid(this.config.sendgrid.apiKey);
        const request = sg.emptyRequest({ method: 'POST', path: '/v3/mail/send', body: mail.toJSON() });
        sg.API(request);
    }
}

module.exports = BSTokenBanking;

module.exports.contracts = Object.freeze(Object.assign({}, BSTokenData.contracts, {
    'BSBanking.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSTokenBanking.sol'), 'utf8')
}));

module.exports.deployContract = function (web3, admin, bsTokenData, permissionManager, gas) {
    const contracts =  Object.assign({}, BSTokenData.contracts, BSTokenBanking.contracts);
    const deployer = new Deployer(web3, {sources: contracts}, 0);
    return deployer.deploy('BSTokenBanking', [bsTokenData.address, permissionManager.address], { from: admin, gas: gas })
        .then(bsTokenBanking => {
            return bsTokenData.addLogicAsync(bsTokenBanking.address, { from: admin, gas: gas })
                .then(() => checkContracts(bsTokenBanking, bsTokenData))
                .then(() => bsTokenBanking);
        })
};

module.exports.deployedContract = function (web3, admin, abi, address, bsTokenData) {
    const bsTokenBanking = web3.eth.contract(abi).at(address);
    Promise.promisifyAll(bsTokenBanking);
    checkContracts(bsTokenBanking, bsTokenData);
    return Promise.resolve(bsTokenBanking);
};

function checkContracts(bsTokenBanking, bsTokenData) {
    if (!bsTokenBanking.abi) {
        throw new Error('abi must not be null');
    }

    if (!bsTokenBanking.address) {
        throw new Error('address must not be null');
    }

    if (typeof bsTokenBanking.cashOutAsync === "undefined") {
        throw new Error('contract has not been properly deployed');
    }

    return bsTokenData.logicsAsync(bsTokenBanking.address)
        .then(exists => {
            if (!exists) {
                throw new Error('bsTokenBanking has not been added as a logic to bsTokenData');
            }
        });
}