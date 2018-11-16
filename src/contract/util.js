const {
  Keccak
} = require('sha3')
const abi = require('ethereumjs-abi')
const address = require('../address')

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

module.exports = {
  keccak256,
  encodeData
}
