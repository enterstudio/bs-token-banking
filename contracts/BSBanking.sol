pragma solidity ^0.4.8;

import "Ownable.sol";
import "BSTokenData.sol";

contract BSBanking is Ownable {

    BSTokenData public tokenData;

    event CashOut(address indexed receiver, uint256 amount, string bankAccount);

    function BSBanking(address bsTokenDataAddress) {
        tokenData = BSTokenData(bsTokenDataAddress);
    }

    function cashOut(address sender, uint256 amount, string bankAccount) onlyOwner {
        if(amount > tokenData.getBalance(sender)) {
            throw;
        }

        tokenData.setBalance(sender, tokenData.getBalance(sender) - amount);
        tokenData.setTotalSupply(tokenData.getTotalSupply() - amount);
        CashOut(sender, amount, bankAccount);
    }

    function cashIn(address sender, uint256 amount) onlyOwner {
        tokenData.setBalance(sender, tokenData.getBalance(sender) + amount);
        tokenData.setTotalSupply(tokenData.getTotalSupply() + amount);
    }

}