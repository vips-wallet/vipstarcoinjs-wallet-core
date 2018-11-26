const BaseAccount = require('./base')
const lib = require('bitcoinjs-lib')
const { NETWORKS } = require('../const')

class BIP49Account extends BaseAccount {
  constructor (config, network) {
    super(config, network)
    this.type = 49
    this.legasySegwit = true
    this.nativeSegwit = false
  }

  generateAddress (change, index) {
    return this.nodeToSegwitAddress(this.pubNode.derive(change).derive(index))

  }

  nodeToSegwitAddress (node) {
    return payments.p2sh({
      redeem: payments.p2wpkh({
        pubkey: node.publicKey,
        network: NETWORKS[this.network]
      }),
      network: NETWORKS[this.network]
    })
  }

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
