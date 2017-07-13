require('dotenv').config()
import { version } from '../../package.json';
import { Router } from 'express';
import facets from './facets'
import rp from 'request-promise'
import redis from 'redis'
import generateCacheKey from 'object-hash'
import bluebird from 'bluebird'
import ghost from 'ghost-api'

const Metascraper = require ('../lib/scrape/index')


const ghostClient = ghost(process.env.GHOST_ENDPOINT)
ghostClient.token = process.env.GHOST_BEARER

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

const cacheClient = redis.createClient(process.env.REDIS_URL)
cacheClient.on('error', (err) => {
  console.log('Error ' + err)
})

const unfluffUrl = async(url) => {
	try {
		const cacheKey = generateCacheKey({ url, type: 'unfluff-url' })
		const cachedResult = await cacheClient.getAsync(cacheKey)
		if (cachedResult) {
			return JSON.parse(cachedResult)
		}

		console.log('meta', Metascraper)

		const result = await Metascraper.scrapeUrl(url)
		console.log('result', result)
		return result
	} catch(e) {
		console.log(e)
		return e
	}
}

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
			const result = await unfluffUrl(url)
			res.json(result)
		} catch(e) {
			console.log(e)
			res.send(e)
		}
	})

	api.get('/share', async(req, res) => {
		try {
			const url = req.query.url
			const content = await unfluffUrl(url)
			const result = await ghostClient.posts.create({
				title: content.title,
				image: content.image,
				markdown: content.text
			})
			res.send(result)
		} catch(e) {
			console.log('error', e)
			res.send(e)
		}
	})

	return api;
}
