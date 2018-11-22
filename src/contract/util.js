const {
  Keccak
} = require('sha3')
const {
  script
} = require('bitcoinjs-lib')
const {BigNumber} = require('bignumber.js')
const scriptNumber = require('bitcoinjs-lib/src/script_number')
const abi = require('ethereumjs-abi')
const address = require('../address')
const {
  OPS,
  DEFAULT_GAS_LIMIT,
  DEFAULT_GAS_PRICE
} = require('../const')

const hash = new Keccak(256)

function keccak256 (v) {
  hash.reset()
  return hash.update(v).digest()
}

function encodeData (method, params) {
  const method_hex = keccak256(method).toString('hex').slice(0, 8)
  const types = []
  const values = []

  params.forEach(([type, value]) => {
    if (type === 'address') {
      if (address.isValidAddress(value)) {
        value = address.getHexAddress(value)
      }
      if (value.slice(0, 2) !== '0x') {
        value = '0x' + value
      }
    }
    types.push(type)
    values.push(value)
  })

  return method_hex + abi.rawEncode(types, values).toString('hex')
}

function compileContractScript (contract_address, data, opt = {}) {
  const gasLimit = new BigNumber(opt.gasLimit ? opt.gasLimit : DEFAULT_GAS_LIMIT)
  const gasPrice = (opt.gasPrice) ? (new BigNumber(opt.gasPrice)).multipliedBy(1e8).dp(0) : new BigNumber(DEFAULT_GAS_PRICE)

  return script.compile([
    0x01,
    0x04,
    scriptNumber.encode(gasLimit),
    scriptNumber.encode(gasPrice),
    Buffer.from(data, 'hex'),
    Buffer.from(contract_address, 'hex'),
    OPS.OP_CALL
  ])
}

module.exports = {
  keccak256,
  encodeData,
  compileContractScript
}
