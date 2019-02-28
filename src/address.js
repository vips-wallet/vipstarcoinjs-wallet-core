const {
  address,
  crypto
} = require('bitcoinjs-lib')
const {NETWORKS} = require('./const')
const base58 = require('bs58')

// Generate address from output script
function fromOutputScript (outputScript, network) {
  network = network || NETWORKS.mainnet
  return address.fromOutputScript(outputScript, network)
}

// Generate output script from address
function toOutputScript (addr, network) {
  network = network || NETWORKS.mainnet
  return address.toOutputScript(addr, network)
}

// Generate address from contract address
function fromContractAddress (contract_address, network) {
  network = network || NETWORKS.mainnet
  const checksum = crypto.sha256(crypto.sha256(Buffer.from(network.pubKeyHash.toString(16) + contract_address, 'hex')))
  const hexAddr = network.pubKeyHash.toString(16) + contract_address + checksum.toString('hex').slice(0, 8)
  return base58.encode(Buffer.from(hexAddr, 'hex'))
}

// Generate contract address from address
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

// Check valid address
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

// Convert VIPSTARCOIN address to hex address
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

// Convert hex address to VIPSTARCOIN address
function fromHexAddress (hexAddr, network) {
  network = network || NETWORKS.mainnet
  return address.toBase58Check(Buffer.from(hexAddr, 'hex'), network.pubKeyHash)
}

// Generate contract address from TXID
function getContractAddressFromTXID (txid, num) {
  const reverseTXID = txid.match(/.{2}/g).reverse().join('')
  let buf = Buffer.alloc(4)
  buf.writeUInt32LE(num, 0)

  return crypto.ripemd160(crypto.sha256(Buffer.from(reverseTXID + buf.toString('hex'), 'hex'))).toString('hex')
}

module.exports = {
  /**
   * Decode VIPSTARCOIN address
   *
   * @param {string} address - VIPSTARCOIN address
   * @return {object} decode result
   */
  fromBase58Check: address.fromBase58Check,
  /**
   * Decode VIPSTARCOIN address (bech32 format)
   *
   * @param {string} address - VIPSTARCOIN address (bech32 format)
   * @return {object} decode result
   */
  fromBech32: address.fromBech32,
  /**
   * Generate address from output script
   *
   * @param {Buffer} outputScript - output script
   * @param {object} network - Network parameters
   * @return {string} generated address
   */
  fromOutputScript: fromOutputScript,
  /**
   * Generate address from contract address
   *
   * @param {string} contract_address - contract address (hex string)
   * @param {object} network - Network parameters
   * @return {string} address
   */
  fromContractAddress: fromContractAddress,
  /**
   * Encode VIPSTARCOIN address
   *
   * @param {Buffer} hash
   * @param {number} version
   * @return {string} encode result
   */
  toBase58Check: address.toBase58Check,
  /**
   * Encode VIPSTARCOIN address (bech32 format)
   *
   * @param {Buffer} data
   * @param {Buffer} hash
   * @param {number} version
   * @return {string} encode result
   */
  toBech32: address.toBech32,
  /**
   * Generate contract address from address
   *
   * @param {string} addr - VIPSTARCOIN address
   * @param {object} network - Network parameters
   * @return {string} contract address
   */
  toContractAddress: toContractAddress,
  /**
   * Generate output script from address
   *
   * @param {string} addr - VIPSTARCOIN address
   * @param {object} network - Network parameters
   * @return {Buffer} output script
   */
  toOutputScript: toOutputScript,
  /**
   * Check valid address
   *
   * @param {string} addr - VIPSTARCOIN address
   * @param {object} network - Network parameters
   * @return {bool} check result
   */
  isValidAddress: isValidAddress,
  /**
   * Convert VIPSTARCOIN address to hex address
   *
   * @param {string} addr - VIPSTARCOIN address
   * @param {object} network - Network parameters
   * @return {string} hex address
   */
  getHexAddress: getHexAddress,
  /**
   * Convert hex address to VIPSTARCOIN address
   *
   * @param {string} hexAddr - hex address
   * @param {object} network - Network parameters
   * @return {string} VIPSTARCOIN address
   */
  fromHexAddress: fromHexAddress,
  /**
   * Generate contract address from TXID
   *
   * @param {string} txid - TXID
   * @param {number} num - vout index
   * @return {string} contract address
   */
  getContractAddressFromTXID: getContractAddressFromTXID
}
