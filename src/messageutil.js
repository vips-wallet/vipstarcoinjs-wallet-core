const {
  script
} = require('bitcoinjs-lib')
const {
  Buffer
} = require('safe-buffer')
const {
  BigNumber
} = require('bignumber.js')
const {
  OP_RETURN_BYTES,
  OPS
} = require('./const')

// Encode message string to OP_RETURN hex-data
function encode (message) {
  return script.compile([OPS.OP_RETURN, Buffer.from(message, 'utf8')])
}

// Decode OP_RETURN hex-data to message string
function decode (hex) {
  let decompiled = script.decompile(Buffer.from(hex, 'hex'))
  let index = decompiled.indexOf(OPS.OP_RETURN)
  if (index > -1 && Buffer.isBuffer(decompiled[index + 1])) {
    return decompiled[index + 1].toString('utf8')
  } else {
    return undefined
  }
}

// Validate message
function isValidMessage (message) {
  let buf = Buffer.from(message, 'utf8')
  return buf.length <= OP_RETURN_BYTES
}

// Encode rate
function encodeRate (amountType, fiatRate) {
  return encode(`v1.0.0|RATE|${amountType}|${fiatRate}`)
}

// Parse rate message
function parseRate (message) {
  let version = message.match(/^(v\d+\.\d+\.\d+)\|RATE/)
  if (!version || !version[1]) {
    return null
  }

  switch (version[1]) {
    case 'v1.0.0':
      return parseRateV1(message)
    default:
      return null
  }
}

// Parse rate message (v1)
function parseRateV1 (message) {
  let sp = message.split('|')
  return {
    rate: new BigNumber(sp[3]).toNumber(),
    currency: sp[2]
  }
}

module.exports = {
  /**
   * Encode message string to OP_RETURN hex-data
   *
   * @param {string} message - message string
   * @return {Buffer} encoded message
   */
  encode: encode,
  /**
   * Decode OP_RETURN hex-data to message string
   *
   * @param {string} hex - hex-encoded message
   * @return {string} decoded message string
   */
  decode: decode,
  /**
   * Encode rate
   *
   * @param {string} amountType - amount type (btc, jpy, etc...)
   * @param {number} fiatRate - rate
   * @return {Buffer} encoded message
   */
  encodeRate: encodeRate,
  /**
   * Parse rate message
   *
   * @param {string} message - rate message
   * @return {object} parsed rate object
   */
  parseRate: parseRate,
  /**
   * Validate message
   *
   * @param {string} message - message string
   * @return {bool} validation result
   */
  isValidMessage: isValidMessage
}
