import PG from 'pg'
import type { Pool } from 'pg'
import type { QueryResult } from 'pg'
import type { QueryConfig } from '$lib/types/db'

import { env } from '$env/dynamic/private'
import { logAlways } from '$lib/log'

let pool: Pool | null = null

export function maybeInitializePool(): Pool {
	if (!pool) {
		logAlways('🐘 Initializing Postgres connection!')
		pool = new PG.Pool({
			// TODO!: Migrate to SvelteKit secrets
			connectionString: env.DB_URL || 'postgres://admin:admin@localhost:5432/db',
			max: parseInt(process.env.DB_CLIENTS || '10')
		})
	}
	return pool
}

export async function query(
	incomingQuery: string,
	params: any[] = [],
	config: QueryConfig = {}
): Promise<QueryResult | null> {
	maybeInitializePool()

	const timingStart = new Date()

	if (config.debug === true || env?.DB_DEBUG === 'true') {
		console.info('----')
		console.info(`🔰 Query: ${incomingQuery}`)
		console.info('📊 Data: ', params)
	}

	if (pool) {
		const results = await pool.query(incomingQuery, params)
		if (config.debug === true || env?.DB_DEBUG === 'true') {
			console.info(
				'⏰ Postgres query execution time: %dms',
				new Date().getTime() - timingStart.getTime()
			)
			console.info('----')
		}

		return results
	} else {
		return null
	}
}

export async function disconnect(): Promise<void> {
	if (pool !== null) {
		logAlways('😵 Disconnecting from Postgres!')
		const thisPool = pool
		pool = null
		return await thisPool.end()
	}

	return
}
