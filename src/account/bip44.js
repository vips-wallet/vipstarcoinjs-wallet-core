const BaseAccount = require('./base')
const {BigNumber} = require('bignumber.js')
const coinSelect = require('coinselect')
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

class BIP44Account extends BaseAccount {
  constructor (config, network) {
    super(config, network)
    this.type = 44
    this.legasySegwit = false
    this.nativeSegwit = false
  }

  generateAddress (change, index) {
    return this.pubNode.derive(change).derive(index).getAddress()
  }

  signTransaction (txBuilder, addressPath, password) {
    let node = this.getNode(password)
    addressPath.forEach((path, i) => {
      txBuilder.sign(i, node.derive(path.change).derive(path.index).keyPair)
    })
    return txBuilder.build()
  }

  async getTokenBalance (addresses = []) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTokenBalance(addresses)
  }

  async getTokenTXsAll (contract_address, addresses = [], txs = [], from = 0, to = 10) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTokenTXsAll(contract_address, addresses, txs, from, to)
  }

  async getTokenTXs (contract_address, addresses = [], from = 0, to = 100) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return await this.api.getTokenTXs(contract_address, addresses, from, to)
  }

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
    const callScript = contractUtil.compileContractScript(contract_address, data, {gasLimit, gasPrice})

    const allUTXOs = await this.getUTXOs()
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
      utxos = allUTXOs
    }

    let { inputs, outputs, fee } = coinSelect(utxos, input, feeRate.toNumber())
    if (inputs === undefined || outputs === undefined) {
      throw new Error("could not find UTXOs")
    }

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
