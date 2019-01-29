const bip39 = require('bip39')
const { bip32 } = require('bitcoinjs-lib')

const {
  BIP44Account,
  BIP49Account
} = require('./account')
const { NETWORKS, COIN_TYPE } = require('./const')
const cryptoUtils = require('./utils/crypto')

/** Class managing multiple wallets generated from a single master key */
class WalletGroup {
  /**
   * Create object.
   *
   * 'Wallet config object' structure:
   *   {
   *     entropy: {string} - encrypted entropy,
   *     seed: {string} - encrypted seed,
   *     default_account: {string} - default account label,
   *     accounts: {array} - account list(more detail: loadAccount function)
   *   }
   *
   * @param {object} config - Wallet config object.
   * @param {string} network - Network type('mainnet' or 'testnet' or 'regtest')
   */
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

  /**
   * Generate new wallet from entropy and seed
   *
   * @param {string} entropy - encrypted entropy
   * @param {string} seed - encrypted seed
   * @param {string} network - Network type('mainnet' or 'testnet' or 'regtest')
   * @return {WalletGroup} WalletGroup object
   */
  static generate (entropy, seed, network) {
    return new WalletGroup({
      entropy: entropy,
      seed: seed,
      accounts: []
    }, network)
  }

  /**
   * Generate new wallet from mnemonic
   *
   * @param {string} mnemonic - mnemonic phrases(space separated)
   * @param {string} password - encrypt password
   * @param {string} network - Network type('mainnet' or 'testnet' or 'regtest')
   * @return {WalletGroup} WalletGroup object
   */
  static fromMnemonic (mnemonic, password, network) {
    return new WalletGroup({
      entropy: cryptoUtils.encrypt(bip39.mnemonicToEntropy(mnemonic), password) ,
      seed: cryptoUtils.encrypt(bip39.mnemonicToSeedHex(mnemonic), password),
      accounts: []
    }, network)
  }

  /**
   * Choose use account class
   *
   * @param {number} type - account type
   * @return {object} account class
   */
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

  /**
   * Convert to mnemonic phrases
   *
   * @return {string} mnemonic phrases
   */
  toMnemonic (password) {
    return bip39.entropyToMnemonic(cryptoUtils.decrypt(this.entropy, password))
  }

  /**
   * Convert to Wallet config object
   *
   * @return {object} Wallet config object
   */
  toJSON () {
    return {
      entropy: this.entropy,
      seed: this.seed,
      default_account: this.defaultAccount,
      accounts: this.accounts.map(account => account.toJSON())
    }
  }

  /**
   * Convert to Wallet config json string
   *
   * @return {string} Wallet config json string
   */
  stringify () {
    return JSON.stringify(this.toJSON())
  }

  /**
   * Load account from account config object
   *
   * 'account config object' structure:
   *   {
   *     account: {number} - Account number defined by BIP-0032
   *     label: {string} - account label
   *     type: {number} - account type (44 or 49)
   *     privkey: {string} - encrypted account private key (derive path: m/purpose'/coin_type'/account')
   *     pubkey: {string} - account public key (derive path: m/purpose'/coin_type'/account')
   *     defaultAddress: {number} - default address index
   *     address_index: {number} - latest generated address's 'address_index'
   *     addresses: {array} - generated addresses list
   *     api: {string} - Remote API name to use
   *   }
   *
   * @param {object} accountConfig - account config object
   */
  loadAccount (accountConfig) {
    let accountClass = this.chooseAccountClass(accountConfig.type)
    this.accounts.push(new accountClass(accountConfig, this.network))
  }

  /**
   * Create new account
   *
   * @param {string} label - account label
   * @param {number} type - account type (44 or 49)
   * @param {number} accountNo - Account number defined by BIP-0032
   * @param {string} password - encryption password
   * @param {string} apiName - Remote API name to use
   * @return {object} account object
   */
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

  /**
   * Get account object by account number
   *
   * @param {number} type - account type (44 or 49)
   * @param {number} accountNo - Account number defined by BIP-0032
   * @return {object} account object
   */
  getAccount (type, accountNo) {
    return this.accounts.find(account => (account.type === type && account.account === accountNo))
  }

  /**
   * Get account object by account label
   *
   * @param {string} label - account label
   * @return {object} account object
   */
  getAccountByLabel (label) {
    if (label === undefined) {
      label = this.defaultAccount
    }
    return this.accounts.find(account => account.label === label)
  }

  /**
   * Get BIP-0032 node
   *
   * @param {number} type - account type (44 or 49)
   * @param {string} password - encryption password
   * @return {object} - bip32 module object
   */
  getNode (type, password) {
    return bip32.fromSeed(
      Buffer.from(cryptoUtils.decrypt(this.seed, password), 'hex'),
      NETWORKS[this.network]
    ).deriveHardened(type).deriveHardened(COIN_TYPE)
  }
}

module.exports = WalletGroup
