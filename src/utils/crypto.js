const crypto = require('crypto')
const IV = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f'

module.exports = {
  encrypt: (data, password) => {
    let m = crypto.createHash('sha256')
    m.update(password)
    password = m.digest().slice(0, 32)

    let cipher = crypto.createCipheriv('aes-256-cbc', password, IV)
    let encrypted = cipher.update(data, 'utf-8', 'base64')
    encrypted += cipher.final('base64')
    return encrypted
  },
  decrypt: (data, password) => {
    let m = crypto.createHash('sha256')
    m.update(password)
    password = m.digest().slice(0, 32)

    let decipher = crypto.createDecipheriv('aes-256-cbc', password, IV)
    let decrypted = decipher.update(data, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}
