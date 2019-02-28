const api = require('../api')
const cryptoUtils = require('../utils/crypto')

const axios = require('axios')
const {BigNumber} = require('bignumber.js')
const coinSelect = require('coinselect')
const bitcoinMessage = require('bitcoinjs-message')
const {
  bip32,
  script
} = require('bitcoinjs-lib')
const {
  TransactionBuilder
} = require('bitcoinjs-lib-vips')

const {
  NETWORKS,
  API_BASEURLS,
  COIN_TYPE,
  COINBASE_MATURITY,
  GAP_LIMIT,
  OP_RETURN_BYTES
} = require('../const')

/** Class managing base account **/
class BaseAccount {
  /**
   * Create object
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
   * @param {object} config - account config object
   * @param {string} network - Network type('mainnet' or 'testnet' or 'regtest')
   * @return
   */
  constructor (config, network) {
    this.account = config.account
    this.label = config.label
    this.type = config.type
    this.legasySegwit = (config.type === 49)
    this.nativeSegwit = (config.type === 84)
    this.privkey = config.privkey
    this.pubkey = config.pubkey
    this.defaultAddress = config.defaultAddress || 0
    this.addressIndex = config.address_index
    this.addresses = config.addresses
    this.network = network
    this.pubNode = bip32.fromBase58(this.pubkey, NETWORKS[this.network])

    let apiClass = this.chooseAPIClass(config.api)
    this.api = new apiClass(this.network)

    this.rescan = this.rescanAddress()
  }

  /**
   * Convert to account config object
   *
   * @return {object} account config object
   */
  toJSON () {
    return {
      account: this.account,
      label: this.label,
      type: this.type,
      privkey: this.privkey,
      pubkey: this.pubkey,
      api: this.api.name,
      address_index: this.addressIndex,
      addresses: this.addresses
    }
  }

  /**
   * Convert to account config json string
   *
   * @return {string} account config json string
   */
  stringify () {
    return JSON.stringify(this.toJSON())
  }

  /**
   * Get 'bip32' library object
   *
   * @see {@link https://github.com/bitcoinjs/bip32|bip32 library repository}
   * @param {string} password - encrypt password
   * @return {object} 'bip32' library object
   */
  getNode (password) {
    return bip32.fromBase58(cryptoUtils.decrypt(this.privkey, password), NETWORKS[this.network])
  }

  /**
   * Generate new address
   *
   * @async
   * @param {bool} scan - scan transactions
   * @result {string} generated address
   */
  async addNewAddress (scan = true) {
    let index = this.addressIndex++
    let newAddress = {
      index: index,
      used: false,
      external: this.generateReceiveAddress(index),
      change: this.generateChangeAddress(index)
    }
    this.addresses.push(newAddress)

    if (scan) {
      const txs = await this.getTXsAll([newAddress.external])
      this.addresses[index].used = (txs.length !== 0)
    }

    return newAddress
  }

  /**
   * Rescan generated addresses's transaction
   *
   * @async
   * @return {bool} rescan result
   */
  async rescanAddress () {
    let searchAddresses = []
    let latestUsedAddressPair = [].concat(this.addresses).reverse().find(address => address.used === true)
    let unusedIndex = 0
    if (latestUsedAddressPair !== undefined) {
      unusedIndex = latestUsedAddressPair.index + 1
    }
    for(let i = unusedIndex; i < (unusedIndex + GAP_LIMIT); i++) {
      let addressPair = []
      if (i >= this.addressIndex) {
        addressPair = await this.addNewAddress(false)
      } else {
        addressPair = this.addresses[i]
      }
      searchAddresses.push(addressPair.external)
    }

    const txs = await this.getTXsAll(searchAddresses)
    if (txs.length === 0) {
      return true
    } else {
      txs.forEach(tx => {
        txs.forEach(vin => {
          if (searchAddresses.includes(vin.addr)) {
            let addressPair = this.findAddressPair(vin.addr)
            this.addresses[addressPair.index].used = true
          }
        })

        tx.vout.forEach(vout => {
          if (vout.scriptPubKey.addresses) {
            vout.scriptPubKey.addresses.forEach(addr => {
              if (searchAddresses.includes(addr)) {
                let addressPair = this.findAddressPair(addr)
                this.addresses[addressPair.index].used = true
              }
            })
          }
        })
      })
      return await this.rescanAddress()
    }
  }

  /**
   * Return API management class object
   *
   * @param {string} name - API name string
   * @return {object} API class object
   */
  chooseAPIClass (name) {
    let apiClass = null
    switch (name) {
      case 'InsightAPI':
        apiClass = api.InsightAPI
        break;
      default:
        throw Error('invalid api name')
    }
    return apiClass
  }

  /**
   * Generate address
   *
   * @return {string} generated address
   */
  generateAddress () {
    throw Error('can\'t generate address')
  }

  /**
   * Generate external(receive) address
   *
   * @see {@link https://github.com/bitcoin/bips/blob/b4853407a7c88cfe72974344f6a642691df53f49/bip-0044.mediawiki|BIP-0044}
   * @param {number} index - BIP44 'address_index'
   * @return {string} generated address
   */
  generateReceiveAddress (index) {
    return this.generateAddress(0, index)
  }

  /**
   * Generate internal(change) address
   *
   * @see {@link https://github.com/bitcoin/bips/blob/b4853407a7c88cfe72974344f6a642691df53f49/bip-0044.mediawiki|BIP-0044}
   * @param {number} index - BIP44 'address_index'
   * @return {string} generated address
   */
  generateChangeAddress (index) {
    return this.generateAddress(1, index)
  }

  /**
   * Get default external(receive) address
   *
   * @return {string} default external(receive) address
   */
  getDefaultReceiveAddress () {
    return this.addresses[this.defaultAddress].external
  }

  /**
   * Get default internal(change) address
   *
   * @return {string} default internal(change) address
   */
  getDefaultChangeAddress () {
    return this.addresses[this.defaultAddress].change
  }

  /**
   * Find address pair
   *
   * @param {string} address - VIPSTARCOIN address
   * @return {object} address pair
   */
  findAddressPair (address) {
    return this.addresses.find(addr => (addr.external === address || addr.change === address))
  }

  /**
   * Build transaction data
   *
   * @async
   * @param {string} to - VIPSTARCOIN address
   * @param {number} amount - sending amount
   * @param {object} opt - option object
   * @return {object} transaction data
   */
  async buildTransactionData (to, amount, opt = {}) {
    let txBuilder = new TransactionBuilder(NETWORKS[this.network])
    txBuilder.setVersion(2)
    let feeRate = null
    if (typeof amount === 'number' || typeof amount === 'string') {
      amount = new BigNumber(amount)
    }
    if (amount.constructor.name !== 'BigNumber') {
      throw new Error("could not convert amount to BigNumber")
    }

    const rate = await this.estimateFeePerByte()
    if (opt.feeRate !== undefined) {
      feeRate = (new BigNumber(opt.feeRate)).multipliedBy(1e8).dp(0)
    } else {
      feeRate = rate.multipliedBy(1e8).dp(0)
    }

    const allUTXOs = await this.getUTXOs([], opt.allow_confirmations || 1)
    let utxos = []
    let satoshis = amount.multipliedBy(1e8)
    let input =[{ address: to, value: satoshis.toNumber() }]
    let addressPath = []

    if (Array.isArray(opt.utxos)) {
      if (opt.utxos.every(utxo => allUTXOs.some(u => (u.txid === utxo.txid && u.vout === utxo.vout)))) {
        utxos = opt.utxos
      } else {
        throw new Error("could not find specified UTXO")
      }
    } else {
      utxos = allUTXOs.filter(utxo => {
        if (utxo.isStakingLocked || utxo.isImmature) {
          return false
        } else {
          return true
        }
      })
    }

    if (typeof opt.extra_data === 'string') {
      let encoded = script.nullData.output.encode(Buffer.from(opt.message, 'utf8'))
      input.push({
        address: encoded,
        value: 0
      })
    } else if (Array.isArray(opt.extra_data)) {
      input = input.concat(opt.extra_data)
    }

    let { inputs, outputs, fee } = coinSelect(utxos, input, feeRate.toNumber())
    if (inputs === undefined || outputs === undefined) {
      throw new Error("could not find UTXOs")
    }

    let senderAddressPair = this.findAddressPair(inputs[0].address)
    if (senderAddressPair === undefined) {
      throw new Error("could not find sender address")
    }

    let vinSum = new BigNumber(0)
    inputs.forEach(input => {
      let vin = txBuilder.addInput(input.txid, input.vout)
      let addressPair = this.findAddressPair(input.address)
      let change = (addressPair.external === input.address ? 0 : 1)
      vinSum = vinSum.plus(input.satoshis)
      addressPath.push({
        change,
        index: addressPair.index
      })
    })

    outputs.forEach(output => {
      if (output.address === undefined) {
        output.address = senderAddressPair.change
      }

      let vout = txBuilder.addOutput(output.address, output.value)
    })

    return {
      txBuilder,
      addressPath,
      fee
    }
  }

  /**
   * Build 'sendto' contract transaction data
   * (only BIP44 account)
   *
   * @async
   * @param {string} contract_address - contract address
   * @param {string} sender_address - VIPSTARCOIN address
   * @param {number} data - contract data
   * @param {object} opt - option object
   * @return {object} transaction data
   */
  async buildSendToContractTransactionData (contract_address, sender_address, data, opt) {
    return Promise.reject(new Error('This account is not BIP44 Account'))
  }

  /**
   * Sign message
   *
   * @see {@link https://github.com/bitcoin/bips/blob/b4853407a7c88cfe72974344f6a642691df53f49/bip-0044.mediawiki|BIP-0044}
   * @param {number} change - BIP44 'change'
   * @param {number} index - BIP44 'address_index'
   * @param {string} message - message
   * @param {string} password - encrypted password
   * @return {string} sign string
   */
  signMessage (change, index, message, password) {
    return bitcoinMessage.sign(
      message,
      this.getNode(password).derive(change).derive(index).privateKey,
      true,
      NETWORKS[this.network].messagePrefix
    ).toString('base64')
  }

  /**
   * Sign message (with address)
   *
   * @param {string} address - VIPSTARCOIN address
   * @param {string} message - message
   * @param {string} password - encrypted password
   * @return {string} sign string
   */
  signMessageWithAddress(address, message, password) {
    let addressPair = this.findAddressPair(address)
    return this.signMessage((address === addressPair.external ? 0 : 1), addressPair.index, message, password)
  }

  /**
   * Verify signed message
   *
   * @param {string} message - message
   * @param {string} address - VIPSTARCOIN address
   * @param {string} sign - sign string
   * @return {bool} verify result
   */
  verifySignedMessage (message, address, sign) {
    return bitcoinMessage.verify(message, address, sign, NETWORKS[this.network].messagePrefix)
  }

  /**
   * Get balance
   *
   * 'opt' structure:
   *   {
   *     allow_confirmations: {number} - required confirmation count
   *     withUTXO: {bool} - include UTXO list switch
   *   }
   *
   * result structure:
   *   {
   *     balance: {BigNumber} - confirmed balance
   *     unconfirmedBalance: {BigNumber} - unconfirmed balance
   *     immatureBalance: {BigNumber} - immature balance
   *     stakingBalance: {BigNumber} - staking balance
   *     utxo: {array} - UTXO list
   *   }
   *
   * @async
   * @param {array} addresses - address list
   * @param {object} opt - option object
   * @return {object} balance detail object
   */
  async getBalanceDetail (addresses = [], opt = {}) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getBalanceDetail(addresses, opt)
  }

  /**
   * Get confirmed balance
   *
   * 'opt' structure:
   *   {
   *     allow_confirmations: {number} - required confirmation count
   *     withUTXO: {bool} - include UTXO list switch
   *   }
   *
   * @async
   * @param {array} addresses - address list
   * @param {object} opt - option object
   * @return {BigNumber} confirmed balance
   */
  async getBalance (addresses = [], opt = {}) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    const info = await this.getBalanceDetail(addresses, opt)
    return info.balance
  }

  /**
   * Get unconfirmed balance
   *
   * 'opt' structure:
   *   {
   *     allow_confirmations: {number} - required confirmation count
   *     withUTXO: {bool} - include UTXO list switch
   *   }
   *
   * @async
   * @param {array} addresses - address list
   * @param {object} opt - option object
   * @return {BigNumber} unconfirmed balance
   */
  async getUnconfirmedBalance (addresses = [], opt = {}) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    const info = await this.getBalanceDetail(addresses, opt)
    return info.unconfirmedBalance
  }

  /**
   * Get transaction list
   *
   * @async
   * @param {array} addresses - address list
   * @param {array} txs - transaction list
   * @param {number} from - start length
   * @param {number} to - end length
   * @return {array} transaction list
   */
  async getTXsAll (addresses = [], txs = [], from = 0, to = 10) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTXsAll(addresses, txs, from, to)
  }

  /**
   * Get transaction list
   *
   * @async
   * @param {array} addresses - address list
   * @param {number} from - start length
   * @param {number} to - end length
   * @return {array} transaction list
   */
  async getTXs (addresses = [], from = 0, to = 10) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTXs(addresses, from, to)
  }

  /**
   * Get UTXO list
   *
   * 'UTXO object' structure:
   *   {
   *     address: {string} - address
   *     txid: {string} - txid
   *     vout: {number} - vout index
   *     scriptPubKey: {string} - scriptPubKey string
   *     amount: {number} - amount value
   *     satoshis: {number} - amount value (unit: satoshi)
   *     isCoinBase: {bool} - if it is coinbase transaction -> true | otherwise -> false
   *     isStake:: {bool} - if it is staking transaction -> true | otherwise -> false
   *     height: {number} - block height
   *     confirmations: {number} - confirmation count
   *     pos: {number} - same 'vout'
   *     value: {number} - same 'satoshis'
   *     hash: {string} - same 'txid'
   *     isStakingLocked: {bool} - if it is staking locked -> true | otherwise -> false
   *     isImmature: {bool} - if it is immature -> true | otherwise -> false
   *   }
   *
   * @async
   * @param {array} addresses - address list
   * @param {number} allow_confirmations - required confirmation count
   * @return {array} UTXO object list
   */
  async getUTXOs (addresses = [], allow_confirmations = 1) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getUTXOs(addresses, allow_confirmations)
  }

  /**
   * Get all ERC20 token balance
   * (only BIP44 account)
   *
   * 'token balance object' structure:
   *   {
   *     amount: {string} - amaunt value
   *     address: {string} - address
   *     address_eth: {string} - address(hex)
   *     contract: {object} {
   *       tx_hash: {string} - txid
   *       vout_idx: {number} - vout index
   *       block_height: {number} - block height
   *       contract_address: {string} - contract address (hex)
   *       contract_address_base: {string} - contract address (VIPSTARCOIN address)
   *       created_at: {string} - token create date
   *       decimals: {string} - token decimals
   *       exception: {bool}
   *       name: {string} - token name
   *       symbol: {string} - token symbol
   *       total_supply: {string} token total supply
   *     }
   *   }
   *
   * @async
   * @param {array} addresses - address list
   * @return {array} all token balance object list
   */
  async getTokenBalance (addresses = []) {
    return Promise.reject(new Error('This account is not BIP44 Account'))
  }

  /**
   * Get all ERC20 token transaction list
   * (only BIP44 account)
   *
   * @async
   * @param {string} contract_address - contract address
   * @param {array} addresses - address list
   * @param {array} txs - transaction list
   * @param {number} from - start length
   * @param {number} to - end length
   * @return {array} transaction list
   */
  async getTokenTXsAll (contract_address, addresses = [], txs = [], from = 0, to = 100) {
    return Promise.reject(new Error('This account is not BIP44 Account'))
  }

  /**
   * Get ERC20 token transaction list
   * (only BIP44 account)
   *
   * @async
   * @param {string} contract_address - contract address
   * @param {array} addresses - address list
   * @param {number} from - start length
   * @param {number} to - end length
   * @return {array} transaction list
   */
  async getTokenTXs (contract_address, addresses = [], from = 0, to = 100) {
    return Promise.reject(new Error('This account is not BIP44 Account'))
  }

  /**
   * Call contract function
   * (only BIP44 account)
   *
   * @async
   * @param {string} address - contract address
   * @param {string} data - call contract data
   * @return {object} call contract result
   */
  async callContract (address, data) {
    return await this.api.callContract(address, data)
  }

  /**
   * Send raw transaction
   *
   * @async
   * @param {string} rawtx - raw signed transaction data
   * @return {object} transaction result
   */
  async sendRawTransaction (tx) {
    return await this.api.sendRawTransaction(tx)
  }

  /**
   * Get transaction receipt
   *
   * @async
   * @param {string} txid - txid
   * @return {object} transaction receipt result
   */
  async getTransactionReceipt (txid) {
    return await this.api.getTransactionReceipt(txid)
  }

  /**
   * Get estimate fee (per kB)
   *
   * @async
   * @param {number} nblocks - block count
   * @return {BigNumber} fee rate
   */
  async estimateFee (nblocks = 6) {
    return await this.api.estimateFee(nblocks)
  }

  /**
   * Get estimate fee (per byte)
   *
   * @async
   * @param {number} nblocks - block count
   * @return {BigNumber} fee rate
   */
  async estimateFeePerByte (nblocks = 6) {
    return await this.api.estimateFeePerByte(nblocks)
  }
}

module.exports = BaseAccount
