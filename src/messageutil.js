const {
  script
} = require('bitcoinjs-lib')
const {
  Buffer
} = require('safe-buffer')
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

module.exports = {
  encode: encode,
  decode: decode,
  isValidMessage: isValidMessage
}
