const axios = require('axios')
const {BigNumber} = require('bignumber.js')

const {
  API_BASEURLS,
  API_DEFAULT_TIMEOUT_MSEC,
  COIN_TYPE,
  COINBASE_MATURITY
} = require('../const')

const addressUtil = require('../address')

class InsightAPI {
  constructor (network, opt = {}) {
    this.name = 'InsightAPI'
    this.network = network
    this.defaultTimeout = (opt.defaultTimeout > 0) ? opt.defaultTimeout : API_DEFAULT_TIMEOUT_MSEC
    this.apiList = (opt.apiList && opt.apiList.length > 0) ? opt.apiList : API_BASEURLS[network]
  }

  async getBalanceDetail (addresses = [], withUTXO = false) {
    const list = await this.getUTXOs(addresses, 0)
    let balance = new BigNumber(0)
    let unconfirmedBalance = new BigNumber(0)
    let stakingBalance = new BigNumber(0)
    let immatureBalance = new BigNumber(0)
    list.forEach(utxo => {
      if (utxo.confirmations) {
        if (utxo.isStakingLocked) {
          stakingBalance = stakingBalance.plus(utxo.satoshis)
        } else {
          balance = balance.plus(utxo.satoshis)
        }
      } else {
        unconfirmedBalance = unconfirmedBalance.plus(utxo.satoshis)
      }
    })
    let info = {
      balance: balance.dividedBy(1e8),
      unconfirmedBalance: unconfirmedBalance.dividedBy(1e8),
      stakingBalance: stakingBalance.dividedBy(1e8)
    }
    if (withUTXO) {
      info.utxo = list
    }
    return info
  }

  async getTXsAll (addresses = [], txs = [], from = 0, to = 10) {
    const result = await this.requestAPI(`/addrs/${addresses.join(',')}/txs`, {
      params: {
        from: from,
        to: to
      }
    })
    const list = result.data
    txs = txs.concat(list.items)
    if (txs.length < list.totalItems) {
      let add = list.totalItems - txs.length
      if (add > 10) add = 10
      return await this.getTXsAll(addresses, txs, txs.length, txs.length + add)
    } else {
      return txs
    }
  }

  async getTXs (addresses = [], from = 0, to = 10) {
    const result = await this.requestAPI(`/addrs/${addresses.join(',')}/txs`, {
      params: {
        from: from,
        to: to
      }
    })
    return result.data
  }

  async getUTXOs (addresses = [], allow_confirmations = 1) {
    const result = await this.requestAPI(`/addrs/${addresses.join(',')}/utxo`)
    return result.data.map(utxo => {
      utxo.pos = utxo.vout
      utxo.value = utxo.satoshis
      utxo.hash = utxo.txid
      utxo.isStakingLocked = (utxo.isStake && utxo.confirmations < COINBASE_MATURITY)
      return utxo
    }).filter(utxo => {
      return utxo.confirmations >= allow_confirmations
    })
  }

  async getTokenBalance (addresses = []) {
    const result = await this.requestAPI(`/erc20/balances`, {
      params: {
        balanceAddress: addresses.join(',')
      }
    })
    return result.data
  }

  async getTokenTXsAll (contract_address, addresses = [], txs = [], from = 0, to = 100) {
    if (!addressUtil.isValidAddress(contract_address)) {
      contract_address = addressUtil.fromContractAddress(contract_address)
    }
    const result = await this.requestAPI(`/tokens/${contract_address}/transactions`, {
      params: {
        addresses: addresses.join(',')
      }
    })
    const list = result.data
    txs = txs.concat(list.items)
    if (txs.length < list.count) {
      let add = list.count - txs.length
      if (add > 100) add = 100
      return await this.getTokenTXsAll(contract_address, addresses, txs, txs.length, txs.length + add)
    } else {
      return txs
    }
  }

  async getTokenTXs (contract_address, addresses = [], from = 0, to = 100) {
    if (!addressUtil.isValidAddress(contract_address)) {
      contract_address = addressUtil.fromContractAddress(contract_address)
    }
    const result = await this.requestAPI(`/tokens/${contract_address}/transactions`, {
      params: {
        addresses: addresses.join(',')
      }
    })
    return result.data
  }

  async callContract (address, data) {
    const result = await this.requestAPI(`/contracts/${address}/hash/${data}/call`)
    return result.data
  }

  async sendRawTransaction (rawtx) {
    const result = await this.postAPI('/tx/send', {rawtx})
    return result.data
  }

  async getTransactionReceipt (txid) {
    const result = await this.requestAPI(`/txs/${txid}/receipt`)
    return result.data
  }

  async estimateFee (nblocks = 6) {
    const result = await this.requestAPI(`/utils/estimateFee`, {
      params: {
        nBlocks: nblocks
      }
    })
    const feeRate = result.data
    if (!(feeRate.constructor.name === 'BigNumber' && feeRate.comparedTo(0) === -1) || typeof feeRate !== 'number' || feeRate < 0) {
      return (new BigNumber(0.004))
    }

    return (new BigNumber(feeRate))
  }

  async estimateFeePerByte (nblock = 6) {
    const minimumFeePerByte = new BigNumber("0.000004")
    const feeRate = await this.estimateFee()

    if (feeRate.comparedTo(0.004) !== 1) {
      return minimumFeePerByte
    }

    return feeRate.dividedBy(1000)
  }

  async requestAPI (path, opt = {}, apiIndex = 0, count = 0, max = 3) {
    if (!opt.timeout) {
      opt.timeout = this.defaultTimeout
    }
    opt.json = true
    const uri = `${this.apiList[apiIndex]}${path}`
    return axios.get(uri, opt).catch(error => {
      if (count === max) {
        if (apiIndex === (this.apiList.length - 1)) {
          throw error
        } else {
          return this.requestAPI(path, opt, ++apiIndex, 0, max)
        }
      }
      return this.requestAPI(path, opt, apiIndex, ++count, max)
    })
  }

  async postAPI (path, opt = {}, apiIndex = 0, count = 0, max = 3) {
    if (!opt.timeout) {
      opt.timeout = this.defaultTimeout
    }
    opt.json = true
    const uri = `${this.apiList[apiIndex]}${path}`
    return axios.post(uri, opt).catch(error => {
        if (apiIndex === (this.apiList.length - 1)) {
          throw error
        } else {
          return this.postAPI(path, opt, ++apiIndex, 0, max)
        }
      return this.postAPI(path, opt, apiIndex, ++count, max)
    })
  }
}

module.exports = InsightAPI
