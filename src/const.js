const NETWORKS = {
  mainnet: {
    name: 'mainnet',
    messagePrefix: '\x18VIPSTARCOIN Signed Message:\n',
    bech32: "bc",
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
    messagePrefix: '\x18VIPSTARCOIN Signed Message:\n',
    bech32: "tb",
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
    messagePrefix: '\x18VIPSTARCOIN Signed Message:\n',
    bech32: "tb",
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
    "https://mainnet.vipstarco.in/api",
    "https://api.vipstarco.in/api"
  ],
  testnet: [
    "https://testnet.vipstarco.in/api"
  ],
  regtest: [
    "https://regtest.vipstarco.in/api"
  ]
}

const COIN_TYPE = 1919

const COINBASE_MATURITY = 500

const GAP_LIMIT = 20

const OP_RETURN_BYTES = 80

const OPS = require('vipstarcoin-opcodes')

module.exports = {
  NETWORKS,
  API_BASEURLS,
  COIN_TYPE,
  COINBASE_MATURITY,
  GAP_LIMIT,
  OP_RETURN_BYTES,
  OPS
}
