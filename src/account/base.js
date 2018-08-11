const api = require('../api')
const cryptoUtils = require('../utils/crypto')

const axios = require('axios')
const {BigNumber} = require('bignumber.js')
const coinSelect = require('coinselect')
const {
  HDNode,
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

class BaseAccount {
  constructor (config, network) {
    this.account = config.account
    this.label = config.label
    this.type = config.type
    this.legasySegwit = (config.type === 49)
    this.nativeSegwit = (config.type === 173)
    this.privkey = config.privkey
    this.pubkey = config.pubkey
    this.defaultAddress = config.defaultAddress || 0
    this.addressIndex = config.address_index
    this.addresses = config.addresses
    this.network = network
    this.pubNode = HDNode.fromBase58(this.pubkey, NETWORKS[this.network])

    let apiClass = this.chooseAPIClass(config.api)
    this.api = new apiClass(this.network)

    this.rescan = this.rescanAddress()
  }

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

  stringify () {
    return JSON.stringify(this.toJSON())
  }

  getNode (password) {
    return HDNode.fromBase58(cryptoUtils.decrypt(this.privkey, password), NETWORKS[this.network])
  }

  addNewAddress (scan = true) {
    let index = this.addressIndex++
    let newAddress = {
      index: index,
      used: false,
      external: this.generateReceiveAddress(index),
      change: this.generateChangeAddress(index)
    }
    this.addresses.push(newAddress)

    if (scan) {
      this.getTXsAll([newAddress.external]).then(txs => {
        this.addresses[index].used = (txs.length !== 0)
      })
    }

    return newAddress
  }

  rescanAddress () {
    return new Promise((resolve, reject) => {
      let searchAddresses = []
      let latestUsedAddressPair = [].concat(this.addresses).reverse().find(address => address.used === true)
      let unusedIndex = 0
      if (latestUsedAddressPair !== undefined) {
        unusedIndex = latestUsedAddressPair.index + 1
      }
      for(let i = unusedIndex; i < (unusedIndex + GAP_LIMIT); i++) {
        let addressPair = []
        if (i >= this.addressIndex) {
          addressPair = this.addNewAddress(false)
        } else {
          addressPair = this.addresses[i]
        }
        searchAddresses.push(addressPair.external)
      }
      resolve(searchAddresses)
    }).then(searchAddresses => {
      return this.getTXsAll(searchAddresses).then(txs => {
        if (txs.length === 0) {
          return true
        } else {
          find: {
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
          }
          return this.rescanAddress()
        }
      })
    })
  }

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

  generateAddress () {
    throw Error('can\'t generate address')
  }

  generateReceiveAddress (index) {
    return this.generateAddress(0, index)
  }

  generateChangeAddress (index) {
    return this.generateAddress(1, index)
  }

  getDefaultReceiveAddress () {
    return this.addresses[this.defaultAddress].external
  }

  getDefaultChangeAddress () {
    return this.addresses[this.defaultAddress].change
  }

  findAddressPair (address) {
    return this.addresses.find(addr => (addr.external === address || addr.change === address))
  }

  buildTransactionData (to, amount, opt = {}) {
    let txBuilder = new TransactionBuilder(NETWORKS[this.network])
    txBuilder.setVersion(2)
    let feeRate = null
    if (typeof amount === 'number' || typeof amount === 'string') {
      amount = new BigNumber(amount)
    }
    if (amount.constructor.name !== 'BigNumber') {
      throw new Error("could not convert amount to BigNumber")
    }
    return this.estimateFeePerByte().then(rate => {
      if (opt.feeRate !== undefined) {
        feeRate = (new BigNumber(opt.feeRate)).multipliedBy(1e8).dp(0)
      } else {
        feeRate = rate.multipliedBy(1e8).dp(0)
      }
      return this.getUTXOs()
    }).then(utxos => {
      let satoshis = amount.multipliedBy(1e8)
      let input =[{ address: to, value: satoshis.toNumber() }]
      let addressPath = []

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
        txBuilder.inputs[vin].value = input.value
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
    })
  }

  generateRawContractTransaction (txBuilder, addressPath, password) {
    throw new Error("could not sign")
  }

  signTransaction () {

  }

  getBalanceDetail (addresses = [], withUTXO = false) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return this.api.getBalanceDetail(addresses, withUTXO)
  }

  getBalance (addresses = []) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return this.getBalanceDetail(addresses).then(info => {
      return info.balance
    })
  }

  getUnconfirmedBalance (addresses = []) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return this.getBalanceDetail(addresses).then(info => {
      return info.unconfirmedBalance
    })
  }

  getTXsAll (addresses = [], txs = [], from = 0, to = 10) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return this.api.getTXsAll(addresses, txs, from, to)
  }

  getTXs (addresses = [], from = 0, to = 10) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return this.api.getTXs(addresses, from, to)
  }

  getUTXOs (addresses = [], allow_confirmations = 1) {
    if (addresses.length === 0) {
      addresses = this.addresses.reduce((acc, address) => acc.concat([address.external, address.change]), [])
    }
    return this.api.getUTXOs(addresses, allow_confirmations)
  }

  callContract (address, data) {
    return this.api.callContract(address, data)
  }

  sendRawTransaction (tx) {
    return this.api.sendRawTransaction(tx)
  }

  estimateFee (nblocks = 6) {
    return this.api.estimateFee(nblocks)
  }

  estimateFeePerByte (nblocks = 6) {
    return this.api.estimateFeePerByte(nblocks)
  }
}

module.exports = BaseAccount
