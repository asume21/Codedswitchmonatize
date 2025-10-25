const crypto = require('crypto');
const key = 'CS-OWNER-' + crypto.randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
console.log(key);
