export const EKUBO_ROUTER = "0x0045f933adf0607292468ad1c1dedaa74d5ad166392590e72676a34d01d7b763";
export const PRAGMA_ORACLE = "0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a";

export const TOKENS = {
  USDC: {
    address: "0x0715649d4c493ca350743e43915b88d2e6838b1c78ddc23d6d9385446b9d6844",
    symbol: "USDC",
    decimals: 6,
    pragmaKey: "0x555344432f555344", // USDC/USD
  },
  ETH: {
    address: "0x07bb0505dde7c05f576a6e08e64dadccd7797f14704763a5ad955727be25e5e9",
    symbol: "ETH",
    decimals: 18,
    pragmaKey: "0x4554482f555344", // ETH/USD
  },
  STRK: {
    address: "0x01278f23115f7e8acf07150b17c1f4b2a58257dde88aad535dbafc142edbd289",
    symbol: "STRK",
    decimals: 18,
    pragmaKey: "0x5354524b2f555344", // STRK/USD
  },
} as const;

export type TokenSymbol = keyof typeof TOKENS;

export const APP_CHAIN = (process.env.NEXT_PUBLIC_CHAIN ?? "sepolia").toLowerCase() as
  | "sepolia"
  | "mainnet";

/** Sepolia ERC-20 used for connected-wallet balance reads (split plan + deposits fallback). */
export const SEPOLIA_WALLET_ERC20 = {
  STRK: {
    address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    symbol: "STRK" as const,
    decimals: 18,
  },
  ETH: {
    address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    symbol: "ETH" as const,
    decimals: 18,
  },
  USDC: {
    address: "0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343",
    symbol: "USDC" as const,
    decimals: 6,
  },
} as const;

export const EKUBO_TOKENS = {
  STRK: SEPOLIA_WALLET_ERC20.STRK.address,
  ETH: SEPOLIA_WALLET_ERC20.ETH.address,
  USDC: SEPOLIA_WALLET_ERC20.USDC.address,
} as const;

/** Wallet balance RPC target: Sepolia uses SEPOLIA_WALLET_ERC20; mainnet uses TOKENS. */
export function walletBalanceTokenAddress(sym: TokenSymbol): string {
  if (APP_CHAIN === "sepolia") return SEPOLIA_WALLET_ERC20[sym].address;
  return TOKENS[sym].address;
}

/** Mintable settlement tokens from deploy (sETH / sSTRK / sUSDC). If unset on Sepolia, payout falls back to SEPOLIA_WALLET_ERC20 addresses. */
export const SYNTH_PAYOUT: Record<TokenSymbol, string> = {
  ETH: process.env.NEXT_PUBLIC_SYNTH_ETH ?? "",
  STRK: process.env.NEXT_PUBLIC_SYNTH_STRK ?? "",
  USDC: process.env.NEXT_PUBLIC_SYNTH_USDC ?? "",
};

export function sepoliaPayoutTokenAddress(sym: TokenSymbol): string {
  const raw = SYNTH_PAYOUT[sym]?.trim();
  if (raw.length > 2) return raw.startsWith("0x") ? raw : `0x${raw}`;
  return EKUBO_TOKENS[sym];
}

/** Mintable mock deposits (mUSDC / mETH / mSTRK). If unset, Sepolia deposits use SEPOLIA_WALLET_ERC20. */
export const SEPOLIA_MOCK_DEPOSIT: Record<TokenSymbol, string> = {
  USDC: process.env.NEXT_PUBLIC_MOCK_USDC ?? "",
  ETH: process.env.NEXT_PUBLIC_MOCK_ETH ?? "",
  STRK: process.env.NEXT_PUBLIC_MOCK_STRK ?? "",
};

export function sepoliaDepositTokenAddress(sym: TokenSymbol): string {
  const raw = SEPOLIA_MOCK_DEPOSIT[sym]?.trim();
  if (raw.length > 2) return raw.startsWith("0x") ? raw : `0x${raw}`;
  return EKUBO_TOKENS[sym];
}

// Vesu vToken addresses on Sepolia
export const VTOKENS: Record<string, string> = {
  [TOKENS.USDC.address]: "0x74655d40dcdf5d0c2d1c508e0d79ca57416dbd51facda53a08f9ec2380cf96d",
  [TOKENS.ETH.address]:  "0x34ce0ff3fc03155376de92c9fafbcf60d033d5dab618e6e87b94ab22ca3ee2b",
  [TOKENS.STRK.address]: "0x5c89191eb94efd85fd4d376eef08a491e19d53f4bf10c1ddbdcb6f1a364d908",
};

// Position types matching Cairo enum
export const POSITION_TYPES = {
  BuyLow: 0,
  SellHigh: 1,
} as const;

// BuyLow: deposit USDC, receive ETH or STRK
// SellHigh: deposit ETH or STRK, receive USDC
export const POSITION_CONFIG = {
  BuyLow: {
    depositToken: "USDC" as TokenSymbol,
    payoutTokens: ["ETH", "STRK"] as TokenSymbol[],
  },
  SellHigh: {
    depositTokens: ["ETH", "STRK"] as TokenSymbol[],
    payoutToken: "USDC" as TokenSymbol,
  },
};

// Strike / settlement display: match on-chain oracle (Chainlink USD pairs use 8 on Starknet).
export const PRAGMA_DECIMALS = Number(process.env.NEXT_PUBLIC_ORACLE_DECIMALS ?? 8);

/** 10^(12 + PRAGMA_DECIMALS); must match on-chain `pragma_strike_scalar` / Chainlink decimals. */
export const STRIKE_SCALAR = 10n ** BigInt(12 + PRAGMA_DECIMALS);

export const CHAIN_ID = "0x534e5f5345504f4c4941"; // SN_SEPOLIA
export const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/O6ulR1EPy8Sn4fYG8_kqU";

/** Canonical Divvy FPMM contract address (frontend-configurable). */
export const DIVVY_FPMM_ADDRESS =
  process.env.NEXT_PUBLIC_DIVVY_FPMM?.trim() ||
  "0x63ce4181a16268ac9588c4868c19b1f281d8912ebace42a6469983c1451eaa9";
