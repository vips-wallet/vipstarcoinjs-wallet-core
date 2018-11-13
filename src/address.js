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
    return (decode.version === network.pubKeyHash || decode.version === network.scriptHash)
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

function getHexAddress (addr, network) {
  network = network || NETWORKS.mainnet

  let decode = null
  try {
    decode = address.fromBase58Check(addr)
  } catch (e) {}

  if (decode && decode.version === network.pubKeyHash) {
    console.log(decode)
    return decode.hash.toString('hex')
  }

  return false
}

function fromHexAddress (hexAddr, network) {
  network = network || NETWORKS.mainnet
  return address.toBase58Check(Buffer.from(hexAddr, 'hex'), network.pubKeyHash)
}

module.exports = {
  fromBase58Check: address.fromBase58Check,
  fromBech32: address.fromBech32,
  fromOutputScript: fromOutputScript,
  toBase58Check: address.toBase58Check,
  toBech32: address.toBech32,
  toOutputScript: toOutputScript,
  isValidAddress: isValidAddress,
  getHexAddress: getHexAddress,
  fromHexAddress: fromHexAddress
}
