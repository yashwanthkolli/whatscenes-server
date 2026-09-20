const mongoose = require('mongoose');
const { getLifecycleHealth } = require('../services/lifecycleRunner.service');

const healthCheck = async (req, res) => {
// Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
        environment: process.env.NODE_ENV
    });
};

const getLifecycleHealthStatus = (req, res) => {
    const lifecycle = getLifecycleHealth();

    const status =
    lifecycle.lastError === null ? "healthy" : "degraded";

    res.status(200).json({
        success: true,
        data: {
        status,
        ...lifecycle,
        },
    });
};

module.exports = { healthCheck, getLifecycleHealthStatus };