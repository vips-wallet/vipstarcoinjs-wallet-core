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

function encode (message) {
  return script.compile([OPS.OP_RETURN, Buffer.from(message, 'utf8')])
}

function decode (hex) {
  let decompiled = script.decompile(Buffer.from(hex, 'hex'))
  let index = decompiled.indexOf(OPS.OP_RETURN)
  if (index > -1 && Buffer.isBuffer(decompiled[index + 1])) {
    return decompiled[index + 1].toString('utf8')
  } else {
    return undefined
  }
}

function isValidMessage (message) {
  let buf = Buffer.from(message, 'utf8')
  return buf.length <= OP_RETURN_BYTES
}

function encodeRate (amountType, fiatRate) {
  return encode(`v1.0.0|RATE|${amountType}|${fiatRate}`)
}

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

function parseRateV1 (message) {
  let sp = message.split('|')
  console.log(sp)
  return {
    rate: new BigNumber(sp[3]).toNumber(),
    currency: sp[2]
  }
}

module.exports = {
  encode: encode,
  decode: decode,
  encodeRate: encodeRate,
  parseRate: parseRate,
  isValidMessage: isValidMessage
}
