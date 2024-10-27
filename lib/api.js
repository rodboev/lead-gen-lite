const axios = require("axios-cache-adapter");
const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDISCLOUD_URL || "redis://localhost",
});
const redisStore = new axios.RedisStore(redisClient);

const api = axios.setup({
  baseURL: "https://data.cityofnewyork.us/resource",
  cache: {
    maxAge: 60 * 60 * 1000, // 1 hour
    exclude: { query: false }, // cache requests with query parameters
    redisStore,
  },
});

module.exports = api;
