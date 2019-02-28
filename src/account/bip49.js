const BaseAccount = require('./base')
const lib = require('bitcoinjs-lib')
const { NETWORKS } = require('../const')

/** Class managing BIP-0049 account **/
class BIP49Account extends BaseAccount {
  /**
   * Create object
   *
   * 'account config object' structure:
   *   {
   *     account: {number} - Account number defined by BIP-0032
   *     label: {string} - account label
   *     type: {number} - account type (49)
   *     privkey: {string} - encrypted account private key (derive path: m/purpose'/coin_type'/account')
   *     pubkey: {string} - account public key (derive path: m/purpose'/coin_type'/account')
   *     defaultAddress: {number} - default address index
   *     address_index: {number} - latest generated address's 'address_index'
   *     addresses: {array} - generated addresses list
   *     api: {string} - Remote API name to use
   *   }
   *
   * @param {object} config - account config object
   * @param {string} network - Network type('mainnet' or 'testnet' or 'regtest')
   * @return
   */
  constructor (config, network) {
    super(config, network)
    this.type = 49
    this.legasySegwit = true
    this.nativeSegwit = false
  }

  /**
   * Generate address
   *
   * @see {@link https://github.com/bitcoin/bips/blob/b4853407a7c88cfe72974344f6a642691df53f49/bip-0044.mediawiki|BIP-0044}
   * @see {@link https://github.com/bitcoin/bips/blob/b4853407a7c88cfe72974344f6a642691df53f49/bip-0049.mediawiki|BIP-0049}
   * @param {number} change - BIP44 'change'
   * @param {number} index - BIP44 'address_index'
   * @return {string} generated address
   */
  generateAddress (change, index) {
    return this.nodeToSegwitAddress(this.pubNode.derive(change).derive(index))

  }

  /**
   * 'bip32' library object to segwit address
   *
   * @see {@link https://github.com/bitcoinjs/bip32|bip32 library repository}
   * @param {object} node - 'bip32' library object
   * @return {string} legacy segwit address
   */
  nodeToSegwitAddress (node) {
    return payments.p2sh({
      redeem: payments.p2wpkh({
        pubkey: node.publicKey,
        network: NETWORKS[this.network]
      }),
      network: NETWORKS[this.network]
    })
  }

  /**
   * Sign transaction
   *
   * @param {TransactionBuilder} txBuilder - TransactionBuilder object
   * @param {array} addressPath - vin addresses
   * @param {string} password - encrypted password
   * @return {Transaction} signed Transaction object
   */
  signTransaction (txBuilder, addressPath, password) {
    let node = this.getNode(password)

    addressPath.forEach((path, i) => {
      let keyPair = node.derive(path.change).derive(path.index).keyPair
      let pubkey = keyPair.getPublicKeyBuffer()
      let redeemScript = lib.script.witnessPubKeyHash.output.encode(lib.crypto.hash160(pubkey))
      txBuilder.sign(i, keyPair, redeemScript, null, txBuilder.inputs[i].value)
    })
    return txBuilder.build()
  }
}

module.exports = BIP49Account
