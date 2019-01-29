const axios = require('axios')
const {BigNumber} = require('bignumber.js')

const {
  API_BASEURLS,
  API_DEFAULT_TIMEOUT_MSEC,
  COIN_TYPE,
  COINBASE_MATURITY
} = require('../const')

const addressUtil = require('../address')

/** Class managing insight API access */
class InsightAPI {
  /**
   * Create object
   *
   * 'opt' structure:
   *   {
   *     defaultTimeout: {number} - connection timeout msec
   *     apiList: {array} - api base uri list
   *   }
   *
   * @param {string} network - Network type('mainnet' or 'testnet' or 'regtest')
   * @param {object} opt - option object
   * @return
   */
  constructor (network, opt = {}) {
    this.name = 'InsightAPI'
    this.network = network
    this.defaultTimeout = (opt.defaultTimeout > 0) ? opt.defaultTimeout : API_DEFAULT_TIMEOUT_MSEC
    this.apiList = (opt.apiList && opt.apiList.length > 0) ? opt.apiList : API_BASEURLS[network]
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
    const allow_confirmations = opt.allow_confirmations || 1
    const list = await this.getUTXOs(addresses, 0)
    let balance = new BigNumber(0)
    let unconfirmedBalance = new BigNumber(0)
    let stakingBalance = new BigNumber(0)
    let immatureBalance = new BigNumber(0)
    list.forEach(utxo => {
      if (utxo.confirmations >= allow_confirmations) {
        if (utxo.isStakingLocked) {
          stakingBalance = stakingBalance.plus(utxo.satoshis)
        } else if (utxo.isImmature) {
          immatureBalance = immatureBalance.plus(utxo.satoshis)
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
      immatureBalance: immatureBalance.dividedBy(1e8),
      stakingBalance: stakingBalance.dividedBy(1e8)
    }
    if (opt.withUTXO) {
      info.utxo = list
    }
    return info
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
    const result = await this.requestAPI(`/addrs/${addresses.join(',')}/txs`, {
      params: {
        from: from,
        to: to
      }
    })
    return result.data
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
    const result = await this.requestAPI(`/addrs/${addresses.join(',')}/utxo`)
    return result.data.map(utxo => {
      utxo.pos = utxo.vout
      utxo.value = utxo.satoshis
      utxo.hash = utxo.txid
      utxo.isStakingLocked = (utxo.isStake && utxo.confirmations < COINBASE_MATURITY)
      utxo.isImmature = (utxo.isCoinBase && utxo.confirmations < COINBASE_MATURITY)
      return utxo
    }).filter(utxo => {
      return utxo.confirmations >= allow_confirmations
    })
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
    const result = await this.requestAPI(`/erc20/balances`, {
      params: {
        balanceAddress: addresses.join(',')
      }
    })
    return result.data
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

  /**
   * Call contract function
   *
   * @async
   * @param {string} address - contract address
   * @param {string} data - call contract data
   * @return {object} call contract result
   */
  async callContract (address, data) {
    const result = await this.requestAPI(`/contracts/${address}/hash/${data}/call`)
    return result.data
  }

  /**
   * Send raw transaction
   *
   * @async
   * @param {string} rawtx - raw signed transaction data
   * @return {object} transaction result
   */
  async sendRawTransaction (rawtx) {
    const result = await this.postAPI('/tx/send', {rawtx})
    return result.data
  }

  /**
   * Get transaction receipt
   *
   * @async
   * @param {string} txid - txid
   * @return {object} transaction receipt result
   */
  async getTransactionReceipt (txid) {
    const result = await this.requestAPI(`/txs/${txid}/receipt`)
    return result.data
  }

  /**
   * Get estimate fee (per kB)
   *
   * @async
   * @param {number} nblocks - block count
   * @return {BigNumber} fee rate
   */
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

  /**
   * Get estimate fee (per byte)
   *
   * @async
   * @param {number} nblocks - block count
   * @return {BigNumber} fee rate
   */
  async estimateFeePerByte (nblock = 6) {
    const minimumFeePerByte = new BigNumber("0.000004")
    const feeRate = await this.estimateFee()

    if (feeRate.comparedTo(0.004) !== 1) {
      return minimumFeePerByte
    }

    return feeRate.dividedBy(1000)
  }

  /**
   * GET request API
   *
   * @async
   * @param {string} path - API path
   * @param {object} opt - option object
   * @param {number} apiIndex - 'apiList' index
   * @param {number} count - call count
   * @param {number} max - max call count
   * @return {object} call API result
   */
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

  /**
   * POST request API
   *
   * @async
   * @param {string} path - API path
   * @param {object} opt - option object
   * @param {number} apiIndex - 'apiList' index
   * @param {number} count - call count
   * @param {number} max - max call count
   * @return {object} call API result
   */
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
