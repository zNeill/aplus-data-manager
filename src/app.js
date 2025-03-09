const express = require('express');
const apiRoutes = require('./routes/apiRoutes');
const hydrationRoutes = require('./routes/hydrationRoutes');
const monitorRoutes = require('./routes/monitorRoutes'); 
const basicAuthMiddleware = require('./middleware/basicAuth');
const logger = require('./utils/logger');

const app = express();
app.use(express.json());

// 🌐 Certain API emulation routes
app.use('/certainExternal/service/v1', basicAuthMiddleware, apiRoutes);

// 🚰 Hydration Routes
app.use('/hydrate', basicAuthMiddleware, hydrationRoutes);

// 👀 Monitoring Route
app.use('/monitor', monitorRoutes); 

module.exports = app;
