const axios = require('axios')
const {BigNumber} = require('bignumber.js')

const {
  API_BASEURLS,
  API_DEFAULT_TIMEOUT_MSEC,
  COIN_TYPE,
  COINBASE_MATURITY
} = require('../const')

class InsightAPI {
  constructor (network, opt = {}) {
    this.name = 'InsightAPI'
    this.network = network
    this.defaultTimeout = (opt.defaultTimeout > 0) ? opt.defaultTimeout : API_DEFAULT_TIMEOUT_MSEC
    this.apiList = (opt.apiList && opt.apiList.length > 0) ? opt.apiList : API_BASEURLS[network]
  }

  getBalanceDetail (addresses = [], withUTXO = false) {
    return this.getUTXOs(addresses, 0).then(list => {
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
    })
  }

  getTXsAll (addresses = [], txs = [], from = 0, to = 10) {
    return this.requestAPI(`/addrs/${addresses.join(',')}/txs`, {
      params: {
        from: from,
        to: to
      }
    }).then(result => {
      const list = result.data
      txs = txs.concat(list.items)
      if (txs.length < list.totalItems) {
        let add = list.totalItems - txs.length
        if (add > 10) add = 10
        return this.getTXsAll(addresses, txs, txs.length, txs.length + add)
      } else {
        return txs
      }
    })
  }

  getTXs (addresses = [], from = 0, to = 10) {
    return this.requestAPI(`/addrs/${addresses.join(',')}/txs`, {
      params: {
        from: from,
        to: to
      }
    }).then(result => {
      return result.data
    })
  }

  getUTXOs (addresses = [], allow_confirmations = 1) {
    return this.requestAPI(`/addrs/${addresses.join(',')}/utxo`).then(result => {
      return result.data.map(utxo => {
        utxo.pos = utxo.vout
        utxo.value = utxo.satoshis
        utxo.hash = utxo.txid
        utxo.isStakingLocked = (utxo.isStake && utxo.confirmations < COINBASE_MATURITY)
        return utxo
      }).filter(utxo => {
        return utxo.confirmations >= allow_confirmations
      })
    })
  }

  callContract (address, data) {
    return this.requestAPI(`/contracts/${address}/hash/${data}/call`).then(result => {
      return result.data
    })
  }

  sendRawTransaction (rawtx) {
    return this.postAPI('/tx/send', {
      rawtx
    }).then(result => {
      return result.data
    })
  }

  estimateFee (nblocks = 6) {
    return this.requestAPI(`/utils/estimateFee`, {
      params: {
        nBlocks: nblocks
      }
    }).then(result => {
      const feeRate = result.data
      if (!(feeRate.constructor.name === 'BigNumber' && feeRate.comparedTo(0) === -1) || typeof feeRate !== 'number' || feeRate < 0) {
        return (new BigNumber(0.004))
      }

      return (new BigNumber(feeRate))
    })
  }

  estimateFeePerByte (nblock = 6) {
    let minimumFeePerByte = new BigNumber("0.000004")
    return this.estimateFee().then(feeRate => {
      if (feeRate.comparedTo(0.004) !== 1) {
        return minimumFeePerByte
      }

      return feeRate.dividedBy(1000)
    })
  }

  requestAPI (path, opt = {}, apiIndex = 0, count = 0, max = 3) {
    if (!opt.timeout) {
      opt.timeout = this.defaultTimeout
    }
    opt.json = true
    let uri = `${this.apiList[apiIndex]}${path}`
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

  postAPI (path, opt = {}, apiIndex = 0, count = 0, max = 3) {
    if (!opt.timeout) {
      opt.timeout = this.defaultTimeout
    }
    opt.json = true
    let uri = `${this.apiList[apiIndex]}${path}`
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
