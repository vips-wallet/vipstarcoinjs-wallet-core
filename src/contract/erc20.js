const {
  TOKEN_METHOD_HASHES
} = require('../const')
const {
  encodeData
} = require('./util')

// Encode 'allowance(address,address)' data
function allowance(owner, spender) {
  return encodeData('allowance(address,address)', [
    ['address', owner],
    ['address', spender]
  ])
}

// Encode 'approve(address,uint256)' data
function approve(spender, value) {
  return encodeData('approve(address,uint256)', [
    ['address', spender],
    ['uint256', value]
  ])
}

// Encode 'balanceOf(address)' data
function balanceOf(who) {
  return encodeData('balanceOf(address)', [
    ['address', who]
  ])
}

// Encode 'decimals()' data
function decimals() {
  return TOKEN_METHOD_HASHES.ERC20['decimals()']
}

// Encode 'name()' data
function name() {
  return TOKEN_METHOD_HASHES.ERC20['name()']
}

// Encode 'symbol()' data
function symbol() {
  return TOKEN_METHOD_HASHES.ERC20['symbol()']
}

// Encode 'totalSupply()' data
function totalSupply() {
  return TOKEN_METHOD_HASHES.ERC20['totalSupply()']
}

// Encoe 'transfer(address,uint256)' data
function transfer(to, value) {
  return encodeData('transfer(address,uint256)', [
    ['address', to],
    ['uint256', value]
  ])
}

// Encoe 'transferFrom(address,address,uint256)' data
function transferFrom(from, to, value) {
  return encodeData('transferFrom(address,address,uint256)', [
    ['address', from],
    ['address', to],
    ['uint256', value]
  ])
}

module.exports = {
  /**
   * Encode 'allowance(address,address)' data
   *
   * @param {string} owner - owner address
   * @param {string} spender - spender address
   * @return {string} encoded contract data
   */
  allowance,
  /**
   * Encode 'approve(address,uint256)' data
   *
   * @param {string} spender - spender address
   * @param {number} value - approved num
   * @return {string} encoded contract data
   */
  approve,
  /**
   * Encode 'balanceOf(address)' data
   *
   * @param {string} who - target address
   * @return {string} encoded contract data
   */
  balanceOf,
  /**
   * Encode 'decimals()' data
   *
   * @return {string} encoded contract data
   */
  decimals,
  /**
   * Encode 'name()' data
   *
   * @return {string} encoded contract data
   */
  name,
  /**
   * Encode 'symbol()' data
   *
   * @return {string} encoded contract data
   */
  symbol,
  /**
   * Encode 'totalSupply()' data
   *
   * @return {string} encoded contract data
   */
  totalSupply,
  /**
   * Encoe 'transfer(address,uint256)' data
   *
   * @param {string} to - address
   * @param {number} value - transfer amount
   * @return {string} encoded contract data
   */
  transfer,
  /**
   * Encoe 'transferFrom(address,address,uint256)' data
   *
   * @param {string} from - address
   * @param {string} to - address
   * @param {number} value - transfer amount
   * @return {string} encoded contract data
   */
  transferFrom
}
