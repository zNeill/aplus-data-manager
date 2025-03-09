const bcrypt = require('bcryptjs');
const pool = require('../config/db');

/**
 * Adds a user to the database
 */
async function addUser(username, password) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        console.log(`User ${username} added successfully.`);
    } catch (error) {
        console.error("Error adding user:", error.message);
    } finally {
        pool.end();
    }
}

// Command-line execution: node addUser.js username password
const args = process.argv.slice(2);
if (args.length === 2) {
    addUser(args[0], args[1]);
} else {
    console.log("Usage: node addUser.js <username> <password>");
}
