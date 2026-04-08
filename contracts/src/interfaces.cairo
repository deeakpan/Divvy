use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IChainlinkAggregator<TContractState> {
    fn decimals(self: @TContractState) -> u8;
    fn latest_round_data(self: @TContractState) -> (felt252, u128, u64, u64, felt252);
}

#[starknet::interface]
pub trait IVesuVToken<TContractState> {
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn withdraw(
        ref self: TContractState, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
    fn redeem(
        ref self: TContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
}
