const Redis = require('ioredis');
const redis = new Redis();
const MAX_CONCURRENT_REQUESTS = 20;
const ACTIVE_REQUESTS_KEY = 'certain_api_active_requests';

async function getActiveRequestCount() {
    const count = await redis.get(ACTIVE_REQUESTS_KEY);
    return count ? parseInt(count, 10) : 0;
}

async function incrementActiveRequests() {
    await redis.incr(ACTIVE_REQUESTS_KEY);
}

async function decrementActiveRequests() {
    const current = await getActiveRequestCount();
    if (current > 0) await redis.decr(ACTIVE_REQUESTS_KEY);
}

async function canMakeRequest() {
    return await getActiveRequestCount() < MAX_CONCURRENT_REQUESTS;
}

module.exports = { getActiveRequestCount, incrementActiveRequests, decrementActiveRequests, canMakeRequest };