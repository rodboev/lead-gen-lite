const axios = require('axios');
const axiosCache = require('axios-cache-adapter');
const redis = require('redis');

const redisClient = redis.createClient({
	url: process.env.REDIS_URL || 'redis://localhost',
})
const redisStore = new axiosCache.RedisStore(redisClient);

const cache = axiosCache.setupCache({
	maxAge: 60 * 60 * 1000, // 1 hour
	exclude: { query: false },
	redisStore
});

const api = axios.create({
	baseURL: 'https://data.cityofnewyork.us/resource',
	adapter: cache.adapter
});

module.exports = api;