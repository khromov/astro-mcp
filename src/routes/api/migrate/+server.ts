import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'

import path from 'path'
import { fileURLToPath } from 'url'
import { migrate } from 'postgres-migrations/src/index'
import { maybeInitializePool } from '$lib/server/db'
import { logWarningAlways } from '$lib/log'

export const GET: RequestHandler = async () => {
	const __filename = fileURLToPath(import.meta.url)
	const __dirname = path.dirname(__filename)
	const messages: string[] = []
	const errors: string[] = []

	const client = maybeInitializePool()

	try {
		const migrationsPath = dev
			? `${__dirname}/../../../../migrations`
			: `${__dirname}/../../migrations`

		const migrations = await migrate({ client }, migrationsPath)

		migrations.forEach((migration) => messages.push(`✅ ${migration.fileName}`))
		messages.push('🏁 Migrations completed')
	} catch (e) {
		logWarningAlways(e)
		errors.push(e?.message || 'Unknown')
	}

	return json({
		messages,
		errors
	})
}
