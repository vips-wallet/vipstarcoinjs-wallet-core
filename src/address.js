const {address} = require('bitcoinjs-lib')
const {NETWORKS} = require('./const')

function fromOutputScript (outputScript, network) {
  network = network || NETWORKS.mainnet
  return address.fromOutputScript(outputScript, network)
}

function toOutputScript (addr, network) {
  network = network || NETWORKS.mainnet
  return address.toOutputScript(addr, network)
}

function isValidAddress (addr, network) {
  network = network || NETWORKS.mainnet

  let decode = null
  try {
    decode = address.fromBase58Check(addr)
  } catch (e) {}

  if (decode) {
    return (decode.version === network.pubKeyHash)
  } else {
    try {
      decode = address.fromBech32(addr)
    } catch (e) {}

    if (decode) {
      return (decode.prefix === network.bech32)
    }
  }

  return false
}

module.exports = {
  fromBase58Check: address.fromBase58Check,
  fromBech32: address.fromBech32,
  fromOutputScript: fromOutputScript,
  toBase58Check: address.toBase58Check,
  toBech32: address.toBech32,
  toOutputScript: toOutputScript,
  isValidAddress: isValidAddress
}
