const {
  TOKEN_METHOD_HASHES
} = require('../const')
const {
  encodeData
} = require('./util')

function allowance(owner, spender) {
  return encodeData('allowance(address,address)', [
    ['address', owner],
    ['address', spender]
  ])
}

function approve(spender, value) {
  return encodeData('approve(address,uint256)', [
    ['address', spender],
    ['uint256', value]
  ])
}

function balanceOf(who) {
  return encodeData('balanceOf(address)', [
    ['address', who]
  ])
}

function decimals() {
  return TOKEN_METHOD_HASHES.ERC20['decimals()']
}

function name() {
  return TOKEN_METHOD_HASHES.ERC20['name()']
}

function symbol() {
  return TOKEN_METHOD_HASHES.ERC20['symbol()']
}

function totalSupply() {
  return TOKEN_METHOD_HASHES.ERC20['totalSupply()']
}

function transfer(to, value) {
  return encodeData('transfer(address,uint256)', [
    ['address', to],
    ['uint256', value]
  ])
}

function transferFrom(from, to, value) {
  return encodeData('transferFrom(address,address,uint256)', [
    ['address', from],
    ['address', to],
    ['uint256', value]
  ])
}

module.exports = {
  allowance,
  approve,
  balanceOf,
  decimals,
  name,
  symbol,
  totalSupply,
  transfer,
  transferFrom
}
