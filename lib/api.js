const axios = require('axios-cache-adapter');
const redis = require('redis');

const redisClient = redis.createClient({
	url: process.env.REDIS_URL || 'redis://localhost',
})
const redisStore = new axios.RedisStore(redisClient);

module.exports = axios.setup({
	baseURL: 'https://data.cityofnewyork.us/resource',
	cache: {
		maxAge: 60 * 60 * 1000, // 1 hour
		exclude: { query: false },
		redisStore
	}
});