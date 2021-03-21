const NETWORKS = {
  mainnet: {
    name: 'mainnet',
    messagePrefix: '\x1cVIPSTARCOIN Signed Message:\n',
    bech32: "vips",
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x46,
    scriptHash: 0x32,
    wif: 0x80
  },
  testnet: {
    name: 'testnet',
    messagePrefix: '\x1cVIPSTARCOIN Signed Message:\n',
    bech32: "tvips",
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x64,
    scriptHash: 0x6e,
    wif: 0xe4
  },
  regtest: {
    name: 'regtest',
    messagePrefix: '\x1cVIPSTARCOIN Signed Message:\n',
    bech32: "tvips",
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x78,
    scriptHash: 0x6e,
    wif: 0xef
  }
}

const API_BASEURLS = {
  mainnet: [
    "https://insight.vipstarcoin.jp/api",
    "https://mainnet.vipstarco.in/api",
    "https://api.vipstarco.in/api",
    "https://insight.vipstarco.in/api"
  ],
  testnet: [
    "https://testnet.vipstarco.in/api"
  ],
  regtest: [
    "https://regtest.vipstarco.in/api"
  ]
}

const API_DEFAULT_TIMEOUT_MSEC = 3000

const COIN_TYPE = 1919

const COINBASE_MATURITY = 500

const GAP_LIMIT = 20

const OP_RETURN_BYTES = 80

const OPS = require('vipstarcoin-opcodes')

const DEFAULT_GAS_LIMIT = 250000

const DEFAULT_GAS_PRICE = 40

const TOKEN_METHOD_HASHES = {
  ERC20: {
    "allowance(address,address)": "dd62ed3e",
    "approve(address,uint256)": "095ea7b3",
    "balanceOf(address)": "70a08231",
    "decimals()": "313ce567",
    "name()": "06fdde03",
    "symbol()": "95d89b41",
    "totalSupply()": "18160ddd",
    "transfer(address,uint256)": "a9059cbb",
    "transferFrom(address,address,uint256)": "23b872dd",
    "Transfer(address,address,uint256)": "ddf252ad",
    "Approval(address,address,uint256)": "8c5be1e5",
    "version()": "54fd4d50"
  }
}

module.exports = {
  // Network Parameters
  NETWORKS,
  // Default API base url list
  API_BASEURLS,
  // Default timeout (milliseconds)
  API_DEFAULT_TIMEOUT_MSEC,
  // BIP-0044 Coin type (see: https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
  COIN_TYPE,
  // COINBASE maturity count
  COINBASE_MATURITY,
  // Address gap limit (see: https://github.com/bitcoin/bips/blob/b4853407a7c88cfe72974344f6a642691df53f49/bip-0044.mediawiki#Address_gap_limit)
  GAP_LIMIT,
  // OP_RETURN max bytes
  OP_RETURN_BYTES,
  // VIPSTARCOIN opcodes
  OPS,
  // Default gas limit (sat)
  DEFAULT_GAS_LIMIT,
  // Default gas price (sat)
  DEFAULT_GAS_PRICE,
  // Standard ERC's method hashes
  TOKEN_METHOD_HASHES
}
