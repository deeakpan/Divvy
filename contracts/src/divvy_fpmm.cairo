use core::num::traits::Zero;
use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

use divvy::interfaces::{
    IERC20Dispatcher, IERC20DispatcherTrait, IChainlinkAggregatorDispatcher,
    IChainlinkAggregatorDispatcherTrait, IVesuVTokenDispatcher, IVesuVTokenDispatcherTrait,
};

#[starknet::interface]
pub trait IDivvyFPMM<TContractState> {
    fn create_market(
        ref self: TContractState,
        question: felt252,
        feed: ContractAddress,
        expiry_time: u64,
        threshold: u128,
        seed_yes: u256,
        seed_no: u256,
    ) -> u64;
    fn buy(
        ref self: TContractState,
        market_id: u64,
        outcome_yes: bool,
        usdc_in: u256,
        min_tokens_out: u256,
    ) -> u256;
    fn sell(
        ref self: TContractState,
        market_id: u64,
        outcome_yes: bool,
        tokens_in: u256,
        min_usdc_out: u256,
    ) -> u256;
    fn resolve_market(ref self: TContractState, market_id: u64);
    fn redeem(ref self: TContractState, market_id: u64) -> u256;
    fn get_market_count(self: @TContractState) -> u64;
    fn get_market_core(
        self: @TContractState, market_id: u64,
    ) -> (felt252, ContractAddress, u64, u128, u64, bool, bool, u128, u64);
    fn get_market_pool(self: @TContractState, market_id: u64) -> (u256, u256, u256, u256);
    fn get_market_yield(self: @TContractState, market_id: u64) -> (bool, u256, u256);
    fn get_user_balances(
        self: @TContractState, market_id: u64, user: ContractAddress,
    ) -> (u256, u256, u256);
    fn get_settlement_state(
        self: @TContractState, market_id: u64,
    ) -> (bool, u256, u256, u256, u256, u256);
    fn preview_buy(
        self: @TContractState, market_id: u64, outcome_yes: bool, usdc_in: u256,
    ) -> u256;
    fn preview_sell(
        self: @TContractState, market_id: u64, outcome_yes: bool, tokens_in: u256,
    ) -> u256;
}

#[starknet::contract]
pub mod DivvyFPMM {
    use super::IDivvyFPMM;
    use super::{
        ContractAddress, IERC20Dispatcher, IERC20DispatcherTrait, IChainlinkAggregatorDispatcher,
        IChainlinkAggregatorDispatcherTrait, IVesuVTokenDispatcher, IVesuVTokenDispatcherTrait,
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess, Zero, get_block_timestamp, get_caller_address,
        get_contract_address,
    };

    #[storage]
    struct Storage {
        owner: ContractAddress,
        usdc_token: ContractAddress,
        usdc_vtoken: ContractAddress,
        market_count: u64,

        market_question: LegacyMap<u64, felt252>,
        market_feed: LegacyMap<u64, ContractAddress>,
        market_expiry: LegacyMap<u64, u64>,
        market_threshold: LegacyMap<u64, u128>,
        market_created_at: LegacyMap<u64, u64>,
        market_resolved: LegacyMap<u64, bool>,
        market_outcome_yes: LegacyMap<u64, bool>,
        market_resolved_price: LegacyMap<u64, u128>,
        market_resolved_timestamp: LegacyMap<u64, u64>,
        yes_reserve: LegacyMap<u64, u256>,
        no_reserve: LegacyMap<u64, u256>,
        invariant_k: LegacyMap<u64, u256>,
        market_collateral: LegacyMap<u64, u256>,
        total_yes_supply: LegacyMap<u64, u256>,
        total_no_supply: LegacyMap<u64, u256>,
        user_yes_balance: LegacyMap<(u64, ContractAddress), u256>,
        user_no_balance: LegacyMap<(u64, ContractAddress), u256>,
        user_deposit: LegacyMap<(u64, ContractAddress), u256>,
        vesu_shares: LegacyMap<u64, u256>,
        total_deposited: LegacyMap<u64, u256>,
        yield_enabled: LegacyMap<u64, bool>,
        settled: LegacyMap<u64, bool>,
        principal_snapshot: LegacyMap<u64, u256>,
        yield_total: LegacyMap<u64, u256>,
        winning_supply_snapshot: LegacyMap<u64, u256>,
        redeemed_winning_total: LegacyMap<u64, u256>,
        redeemed_yield_total: LegacyMap<u64, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MarketCreated: MarketCreated,
        Bought: Bought,
        Sold: Sold,
        MarketResolved: MarketResolved,
        Redeemed: Redeemed,
    }

    #[derive(Drop, starknet::Event)]
    struct MarketCreated {
        #[key]
        market_id: u64,
        #[key]
        creator: ContractAddress,
        feed: ContractAddress,
        expiry_time: u64,
        threshold: u128,
        yield_enabled: bool,
    }

    #[derive(Drop, starknet::Event)]
    struct Bought {
        #[key]
        market_id: u64,
        #[key]
        user: ContractAddress,
        outcome_yes: bool,
        usdc_in: u256,
        tokens_out: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Sold {
        #[key]
        market_id: u64,
        #[key]
        user: ContractAddress,
        outcome_yes: bool,
        tokens_in: u256,
        usdc_out: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct MarketResolved {
        #[key]
        market_id: u64,
        outcome_yes: bool,
        resolved_price: u128,
        resolved_timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Redeemed {
        #[key]
        market_id: u64,
        #[key]
        user: ContractAddress,
        payout: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, owner: ContractAddress, usdc_token: ContractAddress,
        usdc_vtoken: ContractAddress,
    ) {
        assert(!owner.is_zero(), 'bad owner');
        assert(!usdc_token.is_zero(), 'bad usdc');
        assert(!usdc_vtoken.is_zero(), 'bad vtoken');
        self.owner.write(owner);
        self.usdc_token.write(usdc_token);
        self.usdc_vtoken.write(usdc_vtoken);
        self.market_count.write(0);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn nonzero_market(self: @ContractState, market_id: u64) {
            assert(market_id < self.market_count.read(), 'bad market');
        }

        fn maybe_deposit_to_vesu(ref self: ContractState, market_id: u64, assets: u256) {
            if !self.yield_enabled.read(market_id) {
                return;
            };
            if assets == 0_u256 {
                return;
            };
            let vtoken = self.usdc_vtoken.read();
            let usdc = self.usdc_token.read();
            let this = get_contract_address();
            let ok = IERC20Dispatcher { contract_address: usdc }.approve(vtoken, assets);
            assert(ok, 'approve');
            let shares = IVesuVTokenDispatcher { contract_address: vtoken }.deposit(assets, this);
            self.vesu_shares.write(market_id, self.vesu_shares.read(market_id) + shares);
        }

        fn maybe_withdraw_from_vesu(ref self: ContractState, market_id: u64, assets: u256) {
            if !self.yield_enabled.read(market_id) {
                return;
            };
            if assets == 0_u256 {
                return;
            };
            let vtoken = self.usdc_vtoken.read();
            let this = get_contract_address();
            let burned = IVesuVTokenDispatcher { contract_address: vtoken }
                .withdraw(assets, this, this);
            let cur = self.vesu_shares.read(market_id);
            assert(cur >= burned, 'shares');
            self.vesu_shares.write(market_id, cur - burned);
        }
    }

    #[abi(embed_v0)]
    impl DivvyFPMMImpl of IDivvyFPMM<ContractState> {
        fn create_market(
            ref self: ContractState,
            question: felt252,
            feed: ContractAddress,
            expiry_time: u64,
            threshold: u128,
            seed_yes: u256,
            seed_no: u256,
        ) -> u64 {
            assert(!feed.is_zero(), 'bad feed');
            assert(seed_yes > 0_u256, 'seed yes');
            assert(seed_no > 0_u256, 'seed no');
            let now = get_block_timestamp();
            assert(expiry_time > now, 'bad expiry');

            let caller = get_caller_address();
            let this = get_contract_address();
            let seed_total = seed_yes + seed_no;
            let ok = IERC20Dispatcher { contract_address: self.usdc_token.read() }
                .transfer_from(caller, this, seed_total);
            assert(ok, 'seed xfer');

            let id = self.market_count.read();
            self.market_count.write(id + 1);

            self.market_question.write(id, question);
            self.market_feed.write(id, feed);
            self.market_expiry.write(id, expiry_time);
            self.market_threshold.write(id, threshold);
            self.market_created_at.write(id, now);
            self.market_resolved.write(id, false);
            self.market_outcome_yes.write(id, false);
            self.market_resolved_price.write(id, 0_u128);
            self.market_resolved_timestamp.write(id, 0_u64);
            self.yes_reserve.write(id, seed_yes);
            self.no_reserve.write(id, seed_no);
            self.invariant_k.write(id, seed_yes * seed_no);
            self.market_collateral.write(id, seed_total);
            self.total_yes_supply.write(id, 0_u256);
            self.total_no_supply.write(id, 0_u256);
            self.total_deposited.write(id, seed_total);
            self.vesu_shares.write(id, 0_u256);
            self.yield_enabled.write(id, expiry_time - now > 86_400_u64);
            self.settled.write(id, false);
            self.principal_snapshot.write(id, 0_u256);
            self.yield_total.write(id, 0_u256);
            self.winning_supply_snapshot.write(id, 0_u256);
            self.redeemed_winning_total.write(id, 0_u256);
            self.redeemed_yield_total.write(id, 0_u256);
            self.maybe_deposit_to_vesu(id, seed_total);

            self.emit(
                MarketCreated {
                    market_id: id,
                    creator: caller,
                    feed,
                    expiry_time,
                    threshold,
                    yield_enabled: expiry_time - now > 86_400_u64,
                },
            );
            id
        }

        fn buy(
            ref self: ContractState,
            market_id: u64,
            outcome_yes: bool,
            usdc_in: u256,
            min_tokens_out: u256,
        ) -> u256 {
            self.nonzero_market(market_id);
            assert(usdc_in > 0_u256, 'zero in');
            assert(!self.market_resolved.read(market_id), 'resolved');
            assert(get_block_timestamp() < self.market_expiry.read(market_id), 'expired');

            let caller = get_caller_address();
            let this = get_contract_address();
            let ok = IERC20Dispatcher { contract_address: self.usdc_token.read() }
                .transfer_from(caller, this, usdc_in);
            assert(ok, 'buy xfer');

            let k = self.invariant_k.read(market_id);
            let yes0 = self.yes_reserve.read(market_id);
            let no0 = self.no_reserve.read(market_id);

            let out = if outcome_yes {
                let no1 = no0 + usdc_in;
                let yes1 = k / no1;
                let tokens_out = yes0 - yes1;
                assert(tokens_out >= min_tokens_out, 'slip yes');
                self.yes_reserve.write(market_id, yes1);
                self.no_reserve.write(market_id, no1);
                self.user_yes_balance
                    .write((market_id, caller), self.user_yes_balance.read((market_id, caller)) + tokens_out);
                self.total_yes_supply.write(market_id, self.total_yes_supply.read(market_id) + tokens_out);
                tokens_out
            } else {
                let yes1 = yes0 + usdc_in;
                let no1 = k / yes1;
                let tokens_out = no0 - no1;
                assert(tokens_out >= min_tokens_out, 'slip no');
                self.yes_reserve.write(market_id, yes1);
                self.no_reserve.write(market_id, no1);
                self.user_no_balance
                    .write((market_id, caller), self.user_no_balance.read((market_id, caller)) + tokens_out);
                self.total_no_supply.write(market_id, self.total_no_supply.read(market_id) + tokens_out);
                tokens_out
            };

            self.user_deposit.write(
                (market_id, caller), self.user_deposit.read((market_id, caller)) + usdc_in,
            );
            self.total_deposited.write(market_id, self.total_deposited.read(market_id) + usdc_in);
            self.market_collateral.write(market_id, self.market_collateral.read(market_id) + usdc_in);
            self.maybe_deposit_to_vesu(market_id, usdc_in);

            self.emit(Bought { market_id, user: caller, outcome_yes, usdc_in, tokens_out: out });
            out
        }

        fn sell(
            ref self: ContractState,
            market_id: u64,
            outcome_yes: bool,
            tokens_in: u256,
            min_usdc_out: u256,
        ) -> u256 {
            self.nonzero_market(market_id);
            assert(tokens_in > 0_u256, 'zero in');
            assert(!self.market_resolved.read(market_id), 'resolved');
            let caller = get_caller_address();

            let k = self.invariant_k.read(market_id);
            let yes0 = self.yes_reserve.read(market_id);
            let no0 = self.no_reserve.read(market_id);

            let usdc_out = if outcome_yes {
                let bal = self.user_yes_balance.read((market_id, caller));
                assert(bal >= tokens_in, 'bal yes');
                let yes1 = yes0 + tokens_in;
                let no1 = k / yes1;
                let out = no0 - no1;
                assert(out >= min_usdc_out, 'slip out');
                self.user_yes_balance.write((market_id, caller), bal - tokens_in);
                self.total_yes_supply.write(market_id, self.total_yes_supply.read(market_id) - tokens_in);
                self.yes_reserve.write(market_id, yes1);
                self.no_reserve.write(market_id, no1);
                out
            } else {
                let bal = self.user_no_balance.read((market_id, caller));
                assert(bal >= tokens_in, 'bal no');
                let no1 = no0 + tokens_in;
                let yes1 = k / no1;
                let out = yes0 - yes1;
                assert(out >= min_usdc_out, 'slip out');
                self.user_no_balance.write((market_id, caller), bal - tokens_in);
                self.total_no_supply.write(market_id, self.total_no_supply.read(market_id) - tokens_in);
                self.yes_reserve.write(market_id, yes1);
                self.no_reserve.write(market_id, no1);
                out
            };

            let collateral = self.market_collateral.read(market_id);
            assert(collateral >= usdc_out, 'collat');
            self.market_collateral.write(market_id, collateral - usdc_out);
            self.maybe_withdraw_from_vesu(market_id, usdc_out);

            let ok = IERC20Dispatcher { contract_address: self.usdc_token.read() }
                .transfer(caller, usdc_out);
            assert(ok, 'sell xfer');

            self.emit(Sold { market_id, user: caller, outcome_yes, tokens_in, usdc_out });
            usdc_out
        }

        fn resolve_market(ref self: ContractState, market_id: u64) {
            self.nonzero_market(market_id);
            assert(!self.market_resolved.read(market_id), 'resolved');
            assert(get_block_timestamp() >= self.market_expiry.read(market_id), 'not expired');

            let feed = self.market_feed.read(market_id);
            let (_, answer, _, updated_at, _) = IChainlinkAggregatorDispatcher {
                contract_address: feed,
            }.latest_round_data();
            assert(answer > 0_u128, 'zero px');

            let threshold = self.market_threshold.read(market_id);
            let outcome_yes = answer >= threshold;
            self.market_resolved.write(market_id, true);
            self.market_outcome_yes.write(market_id, outcome_yes);
            self.market_resolved_price.write(market_id, answer);
            self.market_resolved_timestamp.write(market_id, updated_at);

            let principal = self.market_collateral.read(market_id);
            self.principal_snapshot.write(market_id, principal);
            let win_supply = if outcome_yes {
                self.total_yes_supply.read(market_id)
            } else {
                self.total_no_supply.read(market_id)
            };
            self.winning_supply_snapshot.write(market_id, win_supply);

            let mut yield_amt = 0_u256;
            if self.yield_enabled.read(market_id) {
                let shares = self.vesu_shares.read(market_id);
                if shares > 0_u256 {
                    let this = get_contract_address();
                    let assets = IVesuVTokenDispatcher { contract_address: self.usdc_vtoken.read() }
                        .redeem(shares, this, this);
                    self.vesu_shares.write(market_id, 0_u256);
                    if assets > principal {
                        yield_amt = assets - principal;
                    };
                };
            };
            self.yield_total.write(market_id, yield_amt);
            self.settled.write(market_id, true);

            self.emit(
                MarketResolved {
                    market_id,
                    outcome_yes,
                    resolved_price: answer,
                    resolved_timestamp: updated_at,
                },
            );
        }

        fn redeem(ref self: ContractState, market_id: u64) -> u256 {
            self.nonzero_market(market_id);
            assert(self.market_resolved.read(market_id), 'not resolved');
            assert(self.settled.read(market_id), 'not settled');
            let caller = get_caller_address();

            let payout = if self.market_outcome_yes.read(market_id) {
                let bal = self.user_yes_balance.read((market_id, caller));
                self.user_yes_balance.write((market_id, caller), 0_u256);
                self.total_yes_supply.write(market_id, self.total_yes_supply.read(market_id) - bal);
                bal
            } else {
                let bal = self.user_no_balance.read((market_id, caller));
                self.user_no_balance.write((market_id, caller), 0_u256);
                self.total_no_supply.write(market_id, self.total_no_supply.read(market_id) - bal);
                bal
            };

            assert(payout > 0_u256, 'no payout');
            let redeemed_prev = self.redeemed_winning_total.read(market_id);
            let redeemed_next = redeemed_prev + payout;
            self.redeemed_winning_total.write(market_id, redeemed_next);

            let win_snap = self.winning_supply_snapshot.read(market_id);
            let y_total = self.yield_total.read(market_id);
            let y_paid_prev = self.redeemed_yield_total.read(market_id);
            let y_part = if y_total == 0_u256 || win_snap == 0_u256 {
                0_u256
            } else if redeemed_next == win_snap {
                y_total - y_paid_prev
            } else {
                (y_total * payout) / win_snap
            };
            self.redeemed_yield_total.write(market_id, y_paid_prev + y_part);

            let gross = payout + y_part;
            let collateral = self.market_collateral.read(market_id);
            assert(collateral >= gross, 'collat');
            self.market_collateral.write(market_id, collateral - gross);

            let ok = IERC20Dispatcher { contract_address: self.usdc_token.read() }
                .transfer(caller, gross);
            assert(ok, 'redeem xfer');

            self.emit(Redeemed { market_id, user: caller, payout: gross });
            gross
        }

        fn get_market_count(self: @ContractState) -> u64 {
            self.market_count.read()
        }

        fn get_market_core(
            self: @ContractState, market_id: u64,
        ) -> (felt252, ContractAddress, u64, u128, u64, bool, bool, u128, u64) {
            self.nonzero_market(market_id);
            (
                self.market_question.read(market_id),
                self.market_feed.read(market_id),
                self.market_expiry.read(market_id),
                self.market_threshold.read(market_id),
                self.market_created_at.read(market_id),
                self.market_resolved.read(market_id),
                self.market_outcome_yes.read(market_id),
                self.market_resolved_price.read(market_id),
                self.market_resolved_timestamp.read(market_id),
            )
        }

        fn get_market_pool(self: @ContractState, market_id: u64) -> (u256, u256, u256, u256) {
            self.nonzero_market(market_id);
            (
                self.yes_reserve.read(market_id),
                self.no_reserve.read(market_id),
                self.invariant_k.read(market_id),
                self.market_collateral.read(market_id),
            )
        }

        fn get_market_yield(self: @ContractState, market_id: u64) -> (bool, u256, u256) {
            self.nonzero_market(market_id);
            (
                self.yield_enabled.read(market_id),
                self.vesu_shares.read(market_id),
                self.total_deposited.read(market_id),
            )
        }

        fn get_user_balances(
            self: @ContractState, market_id: u64, user: ContractAddress,
        ) -> (u256, u256, u256) {
            self.nonzero_market(market_id);
            (
                self.user_yes_balance.read((market_id, user)),
                self.user_no_balance.read((market_id, user)),
                self.user_deposit.read((market_id, user)),
            )
        }

        fn get_settlement_state(
            self: @ContractState, market_id: u64,
        ) -> (bool, u256, u256, u256, u256, u256) {
            self.nonzero_market(market_id);
            (
                self.settled.read(market_id),
                self.principal_snapshot.read(market_id),
                self.yield_total.read(market_id),
                self.winning_supply_snapshot.read(market_id),
                self.redeemed_winning_total.read(market_id),
                self.redeemed_yield_total.read(market_id),
            )
        }

        fn preview_buy(
            self: @ContractState, market_id: u64, outcome_yes: bool, usdc_in: u256,
        ) -> u256 {
            self.nonzero_market(market_id);
            if usdc_in == 0_u256 {
                return 0_u256;
            };
            if self.market_resolved.read(market_id) {
                return 0_u256;
            };
            let yes0 = self.yes_reserve.read(market_id);
            let no0 = self.no_reserve.read(market_id);
            let k = self.invariant_k.read(market_id);
            if outcome_yes {
                let no1 = no0 + usdc_in;
                let yes1 = k / no1;
                yes0 - yes1
            } else {
                let yes1 = yes0 + usdc_in;
                let no1 = k / yes1;
                no0 - no1
            }
        }

        fn preview_sell(
            self: @ContractState, market_id: u64, outcome_yes: bool, tokens_in: u256,
        ) -> u256 {
            self.nonzero_market(market_id);
            if tokens_in == 0_u256 {
                return 0_u256;
            };
            if self.market_resolved.read(market_id) {
                return 0_u256;
            };
            let yes0 = self.yes_reserve.read(market_id);
            let no0 = self.no_reserve.read(market_id);
            let k = self.invariant_k.read(market_id);
            if outcome_yes {
                let yes1 = yes0 + tokens_in;
                let no1 = k / yes1;
                no0 - no1
            } else {
                let no1 = no0 + tokens_in;
                let yes1 = k / no1;
                yes0 - yes1
            }
        }
    }
}
