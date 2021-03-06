const BaseAccount = require('./base')
const {BigNumber} = require('bignumber.js')
const coinSelect = require('coinselect')
const {
  payments
} = require('bitcoinjs-lib')
const {
  TransactionBuilder
} = require('bitcoinjs-lib-vips')
const {
  NETWORKS,
  OPS,
  DEFAULT_GAS_LIMIT,
  DEFAULT_GAS_PRICE
} = require('../const')
const contractUtil = require('../contract/util')

/** Class managing BIP-0044 account **/
class BIP44Account extends BaseAccount {
  /**
   * Create object
   *
   * 'account config object' structure:
   *   {
   *     account: {number} - Account number defined by BIP-0032
   *     label: {string} - account label
   *     type: {number} - account type (only 44)
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
    super(config, network)
    this.type = 44
    this.legasySegwit = false
    this.nativeSegwit = false
  }

  /**
   * Generate address
   *
   * @see {@link https://github.com/bitcoin/bips/blob/b4853407a7c88cfe72974344f6a642691df53f49/bip-0044.mediawiki|BIP-0044}
   * @param {number} change - BIP44 'change'
   * @param {number} index - BIP44 'address_index'
   * @return {string} generated address
   */
  generateAddress (change, index) {
    return payments.p2pkh({
      pubkey: this.pubNode.derive(change).derive(index).publicKey,
      network: NETWORKS[this.network]
    }).address
  }

  /**
   * Sign transaction
   *
   * @param {TransactionBuilder} txBuilder - TransactionBuilder object
   * @param {array} addressPath - vin addresses
   * @param {string} password - encrypted password
   * @return {Transaction} signed Transaction object
   */
  signTransaction (txBuilder, addressPath, password) {
    let node = this.getNode(password)
    addressPath.forEach((path, i) => {
      txBuilder.sign(i, node.derive(path.change).derive(path.index))
    })
    return txBuilder.build()
  }

  /**
   * Get all ERC20 token balance
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
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTokenBalance(addresses)
  }

  /**
   * Get all ERC20 token transaction list
   *
   * @async
   * @param {string} contract_address - contract address
   * @param {array} addresses - address list
   * @param {array} txs - transaction list
   * @param {number} from - start length
   * @param {number} to - end length
   * @return {array} transaction list
   */
  async getTokenTXsAll (contract_address, addresses = [], txs = [], from = 0, to = 10) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTokenTXsAll(contract_address, addresses, txs, from, to)
  }

  /**
   * Get ERC20 token transaction list
   *
   * @async
   * @param {string} contract_address - contract address
   * @param {array} addresses - address list
   * @param {number} from - start length
   * @param {number} to - end length
   * @return {array} transaction list
   */
  async getTokenTXs (contract_address, addresses = [], from = 0, to = 100) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTokenTXs(contract_address, addresses, from, to)
  }

  /**
   * Build 'sendto' contract transaction data
   *
   * @async
   * @param {string} contract_address - contract address
   * @param {string} sender_address - VIPSTARCOIN address
   * @param {number} data - contract data
   * @param {object} opt - option object
   * @return {object} transaction data
   */
  async buildSendToContractTransactionData (contract_address, sender_address, data, opt = {}) {
    const txBuilder = new TransactionBuilder(NETWORKS[this.network])
    txBuilder.setVersion(2)

    const gasLimit = new BigNumber(opt.gasLimit ? opt.gasLimit : DEFAULT_GAS_LIMIT)
    const gasPrice = (opt.gasPrice) ? (new BigNumber(opt.gasPrice)).multipliedBy(1e8).dp(0) : new BigNumber(DEFAULT_GAS_PRICE)
    const gasLimitFee = gasLimit.multipliedBy(gasPrice)

    let amount = opt.amount || new BigNumber(0)
    if (typeof amount === 'number' || typeof amount === 'string') {
      amount = new BigNumber(amount)
    }

    const rate = await this.estimateFeePerByte()
    const feeRate = ((opt.feeRate) ? (new BigNumber(opt.feeRate)) : rate).multipliedBy(1e8).dp(0)
    const callScript = contractUtil.compileContractScript(contract_address, data, {gasLimit, gasPrice: gasPrice.dividedBy(1e8)})

    const allUTXOs = await this.getUTXOs([], opt.allow_confirmations || 1)
    const satoshis = amount.multipliedBy(1e8)
    const input = [
      {value: gasLimitFee.toNumber()},
      {script: callScript, value: satoshis.toNumber()}
    ]

    let utxos = []
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

    let senderUTXOs = utxos.filter(utxo => utxo.address === sender_address)
    let otherUTXOs = utxos.filter(utxo => utxo.address !== sender_address)

    if (senderUTXOs.length === 0) {
      throw new Error("could not find senderAddress UTXOs")
    }

    let inputs = undefined
    let outputs = undefined
    let fee = 0
    let useUTXOs = senderUTXOs
    while (true) {
      let selected = coinSelect(useUTXOs, input, feeRate.toNumber())
      if (selected.inputs !== undefined && selected.outputs !== undefined) {
        inputs = selected.inputs
        outputs = selected.outputs
        fee = selected.fee
        break
      } else if(otherUTXOs.length === 0) {
        throw new Error("could not find UTXOs")
      }
      useUTXOs.push(otherUTXOs.shift())
    }
    inputs = inputs.sort((a, b) => {
      if (a.address === sender_address && b.address === sender_address) {
        return 0
      } else if (a.address === sender_address) {
        return -1
      } else if (b.address === sender_address) {
        return 1
      } else {
        return 0
      }
    })

    const senderAddressPair = this.findAddressPair(sender_address)
    if (senderAddressPair === undefined) {
      throw new Error("could not find sender address")
    }

    let vinSum = new BigNumber(0)
    let addressPath = []
    inputs.forEach(input => {
      const vin = txBuilder.addInput(input.txid, input.vout)
      const addressPair = this.findAddressPair(input.address)
      const change = (addressPair.external === input.address ? 0 : 1)
      vinSum = vinSum.plus(input.satoshis)
      addressPath.push({
        change,
        index: addressPair.index
      })
    })

    const change = vinSum.minus(fee).minus(gasLimitFee).minus(satoshis).toNumber()

    txBuilder.addOutput(callScript, amount.toNumber())
    if (change > 0) {
      txBuilder.addOutput(sender_address, change)
    }

    return {
      txBuilder,
      addressPath,
      fee: gasLimitFee.plus(fee).toNumber()
    }
  }
}

module.exports = BIP44Account
