//! **Divvy Vesu Router** — STRK → Vesu USDC yield in one tx.
//! USDC mint size from Chainlink STRK/USD only (full oracle value, integer division).
//! Then: pull STRK, mint USDC to self, deposit into Vesu vToken → shares to `recipient`.

use starknet::ContractAddress;

#[starknet::interface]
pub trait IDivvyVesuRouter<TContractState> {
    /// Pull `strk_amount` STRK, mint USDC = oracle USD value of that STRK, Vesu `deposit` → shares to `recipient`.
    fn deposit_strk_mint_usdc_to_vesu(
        ref self: TContractState, recipient: ContractAddress, strk_amount: u256,
    );
    /// Same USDC amount the deposit path would mint (live STRK/USD; no staleness check — for UI / logging).
    fn preview_usdc_for_strk(self: @TContractState, strk_amount: u256) -> u256;
    fn owner_withdraw_strk(ref self: TContractState, to: ContractAddress, amount: u256);
    fn refresh_chainlink_prices(ref self: TContractState);
    fn get_last_eth_usd(self: @TContractState) -> (u128, u8);
    fn get_last_strk_usd(self: @TContractState) -> (u128, u8);
    fn get_max_feed_staleness(self: @TContractState) -> u64;
}

#[starknet::contract]
pub mod DivvyVesuRouter {
    use super::IDivvyVesuRouter;
    use starknet::{
        ContractAddress, get_block_timestamp, get_caller_address, get_contract_address,
    };
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use divvy::interfaces::{
        IERC20Dispatcher, IERC20DispatcherTrait,
        IChainlinkAggregatorDispatcher, IChainlinkAggregatorDispatcherTrait,
        IMintableERC20Dispatcher, IMintableERC20DispatcherTrait,
        IVesuVTokenDispatcher, IVesuVTokenDispatcherTrait,
    };

    #[storage]
    struct Storage {
        owner: ContractAddress,
        strk_token: ContractAddress,
        vesu_usdc: ContractAddress,
        usdc_vtoken: ContractAddress,
        eth_usd_feed: ContractAddress,
        strk_usd_feed: ContractAddress,
        strk_decimals: u8,
        usdc_decimals: u8,
        max_feed_staleness_secs: u64,
        last_eth_answer: u128,
        last_eth_decimals: u8,
        last_strk_answer: u128,
        last_strk_decimals: u8,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        StrkVesuYieldEntered: StrkVesuYieldEntered,
        OwnerWithdrawStrk: OwnerWithdrawStrk,
        ChainlinkPricesUpdated: ChainlinkPricesUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct StrkVesuYieldEntered {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub recipient: ContractAddress,
        pub strk_amount: u256,
        pub usdc_minted: u256,
        pub shares_minted: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct OwnerWithdrawStrk {
        #[key]
        pub to: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct ChainlinkPricesUpdated {
        pub eth_answer: u128,
        pub eth_decimals: u8,
        pub strk_answer: u128,
        pub strk_decimals: u8,
    }

    fn pow10_u256(mut exp: u8) -> u256 {
        let mut acc: u256 = 1_u256;
        let ten: u256 = 10_u256;
        loop {
            if exp == 0 {
                break;
            }
            acc = acc * ten;
            exp -= 1;
        };
        acc
    }

    fn usdc_from_strk_oracle(
        strk_amount: u256,
        strk_decimals: u8,
        usdc_decimals: u8,
        feed_decimals: u8,
        answer: u128,
    ) -> u256 {
        assert(answer > 0_u128, 'zero px');
        let price: u256 = answer.into();
        let num = strk_amount * price * pow10_u256(usdc_decimals);
        let den = pow10_u256(strk_decimals) * pow10_u256(feed_decimals);
        num / den
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        strk_token: ContractAddress,
        vesu_usdc: ContractAddress,
        usdc_vtoken: ContractAddress,
        eth_usd_feed: ContractAddress,
        strk_usd_feed: ContractAddress,
        strk_decimals: u8,
        usdc_decimals: u8,
        max_feed_staleness_secs: u64,
    ) {
        assert(!owner.is_zero(), 'bad owner');
        assert(!strk_token.is_zero(), 'bad strk');
        assert(!vesu_usdc.is_zero(), 'bad usdc');
        assert(!usdc_vtoken.is_zero(), 'bad vtoken');
        assert(!eth_usd_feed.is_zero(), 'bad eth feed');
        assert(!strk_usd_feed.is_zero(), 'bad strk feed');
        self.owner.write(owner);
        self.strk_token.write(strk_token);
        self.vesu_usdc.write(vesu_usdc);
        self.usdc_vtoken.write(usdc_vtoken);
        self.eth_usd_feed.write(eth_usd_feed);
        self.strk_usd_feed.write(strk_usd_feed);
        self.strk_decimals.write(strk_decimals);
        self.usdc_decimals.write(usdc_decimals);
        self.max_feed_staleness_secs.write(max_feed_staleness_secs);
        self.last_eth_answer.write(0_u128);
        self.last_eth_decimals.write(0_u8);
        self.last_strk_answer.write(0_u128);
        self.last_strk_decimals.write(0_u8);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn read_strk_usd_round(self: @ContractState) -> (u128, u8, u64) {
            let feed = self.strk_usd_feed.read();
            let dec = IChainlinkAggregatorDispatcher { contract_address: feed }.decimals();
            let (_, ans, _, _, updated_at) = IChainlinkAggregatorDispatcher { contract_address: feed }
                .latest_round_data();
            (ans, dec, updated_at)
        }

        fn usdc_for_strk_now(self: @ContractState, strk_amount: u256) -> u256 {
            let (ans, fdec, _) = self.read_strk_usd_round();
            usdc_from_strk_oracle(
                strk_amount,
                self.strk_decimals.read(),
                self.usdc_decimals.read(),
                fdec,
                ans,
            )
        }
    }

    #[abi(embed_v0)]
    impl DivvyVesuRouterImpl of IDivvyVesuRouter<ContractState> {
        fn deposit_strk_mint_usdc_to_vesu(
            ref self: ContractState, recipient: ContractAddress, strk_amount: u256,
        ) {
            assert(!recipient.is_zero(), 'zero recipient');
            assert(strk_amount > 0_u256, 'zero strk');

            let now: u64 = get_block_timestamp();
            let (answer, feed_decimals, updated_at) = self.read_strk_usd_round();
            assert(answer > 0_u128, 'zero px');
            assert(updated_at <= now, 'px future');
            assert(now - updated_at <= self.max_feed_staleness_secs.read(), 'stale px');

            let usdc_amt = usdc_from_strk_oracle(
                strk_amount,
                self.strk_decimals.read(),
                self.usdc_decimals.read(),
                feed_decimals,
                answer,
            );
            assert(usdc_amt > 0_u256, 'dust usdc');

            let caller = get_caller_address();
            let this = get_contract_address();
            let strk = self.strk_token.read();
            let usdc = self.vesu_usdc.read();
            let vtoken = self.usdc_vtoken.read();

            let ok_strk = IERC20Dispatcher { contract_address: strk }
                .transfer_from(caller, this, strk_amount);
            assert(ok_strk, 'strk xfer');

            IMintableERC20Dispatcher { contract_address: usdc }.mint(this, usdc_amt);

            let ok_appr = IERC20Dispatcher { contract_address: usdc }.approve(vtoken, usdc_amt);
            assert(ok_appr, 'usdc appr');

            let shares = IVesuVTokenDispatcher { contract_address: vtoken }.deposit(usdc_amt, recipient);

            self.emit(StrkVesuYieldEntered {
                caller,
                recipient,
                strk_amount,
                usdc_minted: usdc_amt,
                shares_minted: shares,
            });
        }

        fn preview_usdc_for_strk(self: @ContractState, strk_amount: u256) -> u256 {
            if strk_amount == 0_u256 {
                return 0_u256;
            }
            self.usdc_for_strk_now(strk_amount)
        }

        fn owner_withdraw_strk(ref self: ContractState, to: ContractAddress, amount: u256) {
            assert(get_caller_address() == self.owner.read(), 'Not owner');
            assert(!to.is_zero(), 'zero to');
            assert(amount > 0_u256, 'zero amt');
            let strk = self.strk_token.read();
            let ok = IERC20Dispatcher { contract_address: strk }.transfer(to, amount);
            assert(ok, 'withdraw xfer');
            self.emit(OwnerWithdrawStrk { to, amount });
        }

        fn refresh_chainlink_prices(ref self: ContractState) {
            let eth_feed = self.eth_usd_feed.read();
            let strk_feed = self.strk_usd_feed.read();

            let eth_dec = IChainlinkAggregatorDispatcher { contract_address: eth_feed }.decimals();
            let (_, eth_ans, _, _, _) = IChainlinkAggregatorDispatcher { contract_address: eth_feed }
                .latest_round_data();

            let strk_dec = IChainlinkAggregatorDispatcher { contract_address: strk_feed }.decimals();
            let (_, strk_ans, _, _, _) = IChainlinkAggregatorDispatcher { contract_address: strk_feed }
                .latest_round_data();

            self.last_eth_decimals.write(eth_dec);
            self.last_strk_decimals.write(strk_dec);
            self.last_eth_answer.write(eth_ans);
            self.last_strk_answer.write(strk_ans);

            self.emit(ChainlinkPricesUpdated {
                eth_answer: eth_ans,
                eth_decimals: eth_dec,
                strk_answer: strk_ans,
                strk_decimals: strk_dec,
            });
        }

        fn get_last_eth_usd(self: @ContractState) -> (u128, u8) {
            (self.last_eth_answer.read(), self.last_eth_decimals.read())
        }

        fn get_last_strk_usd(self: @ContractState) -> (u128, u8) {
            (self.last_strk_answer.read(), self.last_strk_decimals.read())
        }

        fn get_max_feed_staleness(self: @ContractState) -> u64 {
            self.max_feed_staleness_secs.read()
        }
    }
}
