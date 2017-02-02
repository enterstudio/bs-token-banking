pragma solidity ^0.4.2;

import "Ownable.sol";
import "BSTokenData.sol";

contract BSTokenBanking is Ownable {

    BSTokenData public tokenData;

    event CashOut(address indexed receiver, uint256 amount, string bankAccount);

    function BSTokenBanking(address bsTokenDataAddress) {
        tokenData = BSTokenData(bsTokenDataAddress);
    }

    function cashOut(uint256 amount, string bankAccount) {
        if(amount > tokenData.getBalance(msg.sender)) {
            throw;
        }

        tokenData.setBalance(msg.sender, tokenData.getBalance(msg.sender) - amount);
        tokenData.setTotalSupply(tokenData.getTotalSupply() - amount);
        CashOut(msg.sender, amount, bankAccount);
    }

    function cashIn(address sender, uint256 amount) onlyAdmin {
        tokenData.setBalance(sender, tokenData.getBalance(sender) + amount);
        tokenData.setTotalSupply(tokenData.getTotalSupply() + amount);
    }

    modifier onlyAdmin {
        if (msg.sender != owner) throw;
        _;
    }
}