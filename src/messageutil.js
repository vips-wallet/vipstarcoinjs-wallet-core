const {
  script
} = require('bitcoinjs-lib')
const {
  Buffer
} = require('safe-buffer')
const {
  OP_RETURN_BYTES
} = require('./const')

function encode (message) {
  return script.nullData.output.encode(Buffer.from(message, 'utf8'))
}

function decode (hex) {
  return script.nullData.output.decode(new Buffer(hex, 'hex')).toString('utf8')
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
