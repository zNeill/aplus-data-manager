require('dotenv').config(); // ✅ Load .env file at the beginning
const crypto = require('crypto');

const SECRET_KEY = process.env.SECRET_KEY || "my_strong_secret_key"; // Fallback for missing SECRET_KEY

/**
 * Encrypts a given string using AES-256-CBC
 */
function encrypt(text) {
    if (!SECRET_KEY || SECRET_KEY == "my_strong_secret_key") {
        console.error("❌ ERROR: SECRET_KEY is missing. Make sure your .env file is loaded.");
        process.exit(1);
    }

    const iv = crypto.randomBytes(16); // Generate a random IV
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SECRET_KEY, 'utf-8'), iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`; // Return IV and encrypted text
}

/**
 * Decrypts an AES-256 encrypted string
 */
function decrypt(text) {
    const [ivHex, encryptedText] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SECRET_KEY, 'utf-8'), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}

// If running from CLI, accept username and password as arguments
if (require.main === module) {
    require('dotenv').config(); // ✅ Load .env when running via CLI

    const args = process.argv.slice(2);

    if (args.length !== 2) {
        console.log("Usage: node src/utils/encryptCredentials.js <username> <password>");
        process.exit(1);
    }

    const encryptedUsername = encrypt(args[0]);
    const encryptedPassword = encrypt(args[1]);

    console.log("Encrypted Username:", encryptedUsername);
    console.log("Encrypted Password:", encryptedPassword);
}

module.exports = { encrypt, decrypt };
