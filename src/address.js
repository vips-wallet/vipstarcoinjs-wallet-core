const {
  address,
  crypto
} = require('bitcoinjs-lib')
const {NETWORKS} = require('./const')
const base58 = require('bs58')

function fromOutputScript (outputScript, network) {
  network = network || NETWORKS.mainnet
  return address.fromOutputScript(outputScript, network)
}

function toOutputScript (addr, network) {
  network = network || NETWORKS.mainnet
  return address.toOutputScript(addr, network)
}

function fromContractAddress (contract_address, network) {
  network = network || NETWORKS.mainnet
  const checksum = crypto.sha256(crypto.sha256(Buffer.from(network.pubKeyHash.toString(16) + contract_address, 'hex')))
  const hexAddr = network.pubKeyHash.toString(16) + contract_address + checksum.toString('hex').slice(0, 8)
  return base58.encode(Buffer.from(hexAddr, 'hex'))
}

function toContractAddress (addr, network) {
  network = network || NETWORKS.mainnet

  let decode = null
  try {
    decode = base58.decode(addr)
  } catch (e) {}

  if (decode) {
    const hexAddr = decode.toString('hex')
    const pubKeyHash = hexAddr.slice(0, network.pubKeyHash.toString(16).length)
    const contract_address = hexAddr.slice(network.pubKeyHash.toString(16).length, -8)
    const checksum = hexAddr.slice(-8, hexAddr.length)
    const calc_checksum = crypto.sha256(crypto.sha256(Buffer.from(network.pubKeyHash.toString(16) + contract_address, 'hex'))).toString('hex').slice(0, 8)

    if (network.pubKeyHash.toString(16) === pubKeyHash && checksum === calc_checksum) {
      return contract_address
    } else {
      false
    }
  }

  return false
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
    return decode.hash.toString('hex')
  }

  return false
}

function fromHexAddress (hexAddr, network) {
  network = network || NETWORKS.mainnet
  return address.toBase58Check(Buffer.from(hexAddr, 'hex'), network.pubKeyHash)
}

function getContractAddressFromTXID (txid, num) {
  const reverseTXID = txid.match(/.{2}/g).reverse().join('')
  let buf = Buffer.alloc(4)
  buf.writeUInt32LE(num, 0)

  return crypto.ripemd160(crypto.sha256(Buffer.from(reverseTXID + buf.toString('hex'), 'hex'))).toString('hex')
}

module.exports = {
  fromBase58Check: address.fromBase58Check,
  fromBech32: address.fromBech32,
  fromOutputScript: fromOutputScript,
  fromContractAddress: fromContractAddress,
  toBase58Check: address.toBase58Check,
  toBech32: address.toBech32,
  toContractAddress: toContractAddress,
  toOutputScript: toOutputScript,
  isValidAddress: isValidAddress,
  getHexAddress: getHexAddress,
  fromHexAddress: fromHexAddress,
  getContractAddressFromTXID: getContractAddressFromTXID
}
