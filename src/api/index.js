require('dotenv').config()
import { version } from '../../package.json';
import { Router } from 'express';
import facets from './facets';
import unfluff from 'unfluff'
import rp from 'request-promise'
import redis from 'redis'
import generateCacheKey from 'object-hash'
import bluebird from 'bluebird'

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

const cacheClient = redis.createClient(process.env.REDIS_URL)
cacheClient.on('error', (err) => {
  console.log('Error ' + err)
})

export default ({ config, db }) => {
	let api = Router();

	// mount the facets resource
	api.use('/facets', facets({ config, db }));

	// perhaps expose some API metadata at the root
	api.get('/', (req, res) => {
		res.json({ version });
	});

	api.get('/xtract', async(req, res) => {
		try {
			const url = req.query.url
			const cacheKey = generateCacheKey({ url, type: 'unfluff-url' })
			const cachedResult = await cacheClient.getAsync(cacheKey)
			if (cachedResult) {
				return res.json(JSON.parse(cachedResult))
			}

			const html = await rp(url)
			const xtract = unfluff(html, 'en')
			cacheClient.setex(cacheKey, process.env.CACHE_LIFETIME, JSON.stringify(xtract))
			console.log(xtract)
			res.json(xtract)
		} catch(e) {
			console.log(e)
			res.send(e)
		}
	})

	return api;
}
