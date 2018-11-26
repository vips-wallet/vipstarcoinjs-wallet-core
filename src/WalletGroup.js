const bip39 = require('bip39')
const { bip32 } = require('bitcoinjs-lib')

const {
  BIP44Account,
  BIP49Account
} = require('./account')
const { NETWORKS, COIN_TYPE } = require('./const')
const cryptoUtils = require('./utils/crypto')

class WalletGroup {
  constructor (config, network) {
    this.entropy = config.entropy
    this.seed = config.seed
    this.defaultAccount = config.default_account
    this.accounts = []
    this.network = network

    config.accounts.forEach((accountConfig) => {
      this.loadAccount(accountConfig)
    })
  }

  static generate (entropy, seed, network) {
    return new WalletGroup({
      entropy: entropy,
      seed: seed,
      accounts: []
    }, network)
  }

  static fromMnemonic (mnemonic, password, network) {
    return new WalletGroup({
      entropy: cryptoUtils.encrypt(bip39.mnemonicToEntropy(mnemonic), password) ,
      seed: cryptoUtils.encrypt(bip39.mnemonicToSeedHex(mnemonic), password),
      accounts: []
    }, network)
  }

  chooseAccountClass (type) {
    let accountClass = null
    switch (type) {
      case 44:
        accountClass = BIP44Account
        break
      case 49:
        accountClass = BIP49Account
        break
      default:
        throw Error('invalid account type')
    }
    return accountClass
  }

  toMnemonic (password) {
    return bip39.entropyToMnemonic(cryptoUtils.decrypt(this.entropy, password))
  }

  toJSON () {
    return {
      entropy: this.entropy,
      seed: this.seed,
      default_account: this.defaultAccount,
      accounts: this.accounts.map(account => account.toJSON())
    }
  }

  stringify () {
    return JSON.stringify(this.toJSON())
  }

  loadAccount (accountConfig) {
    let accountClass = this.chooseAccountClass(accountConfig.type)
    this.accounts.push(new accountClass(accountConfig, this.network))
  }

  createAccount (label, type, accountNo, password, apiName = "InsightAPI") {
    let accountClass = this.chooseAccountClass(type)
    let node = this.getNode(type, password).deriveHardened(accountNo)
    let account = new accountClass({
      account: accountNo,
      label: label,
      type: type,
      privkey: cryptoUtils.encrypt(node.toBase58(), password),
      pubkey: node.neutered().toBase58(),
      api: apiName,
      address_index: 0,
      addresses: []
    }, this.network)
    this.accounts.push(account)
    return account
  }

  getAccount (type, accountNo) {
    return this.accounts.find(account => (account.type === type && account.account === accountNo))
  }

  getAccountByLabel (label) {
    if (label === undefined) {
      label = this.defaultAccount
    }
    return this.accounts.find(account => account.label === label)
  }

  getNode (type, password) {
    return bip32.fromSeed(
      Buffer.from(cryptoUtils.decrypt(this.seed, password), 'hex'),
      NETWORKS[this.network]
    ).deriveHardened(type).deriveHardened(COIN_TYPE)
  }
}

module.exports = WalletGroup
