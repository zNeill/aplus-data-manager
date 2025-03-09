const auth = require('basic-auth');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

/**
 * Middleware for HTTP Basic Authentication with PostgreSQL
 */
const basicAuthMiddleware = async (req, res, next) => {
    const credentials = auth(req);

    if (!credentials || !credentials.name || !credentials.pass) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Restricted Area"');
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        // Check if user exists
        const query = 'SELECT password FROM users WHERE username = $1';
        const { rows } = await pool.query(query, [credentials.name]);

        if (rows.length === 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const storedPassword = rows[0].password;

        // Compare the provided password with the stored hash
        const isMatch = await bcrypt.compare(credentials.pass, storedPassword);
        if (!isMatch) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // User is authenticated
        next();
    } catch (error) {
        console.error("Authentication error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = basicAuthMiddleware;
