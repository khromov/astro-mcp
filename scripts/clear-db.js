#!/usr/bin/env node

import PG from 'pg'
import { migrate } from 'postgres-migrations'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Hardcoded to match the default in src/lib/server/db.ts
const DB_URL = 'postgres://admin:admin@localhost:5432/db'

async function clearAndRecreateDatabase() {
	console.log('🔄 Starting database reset...')
	console.log(`📡 Connecting to: ${DB_URL}`)

	const client = new PG.Pool({
		connectionString: DB_URL,
		max: 1
	})

	try {
		// Test connection first
		await client.query('SELECT NOW()')
		console.log('✅ Database connection successful')

		console.log('🗑️  Dropping all tables...')
		
		// Drop all tables, sequences, functions, etc. in the public schema
		await client.query(`
			DROP SCHEMA IF EXISTS public CASCADE;
			CREATE SCHEMA public;
			GRANT ALL ON SCHEMA public TO public;
			GRANT ALL ON SCHEMA public TO postgres;
		`)

		console.log('✅ All tables and schema objects dropped successfully')

		console.log('🏗️  Running migrations...')
		
		// Determine migrations path
		const migrationsPath = path.join(__dirname, '..', 'migrations')
		console.log(`📁 Looking for migrations in: ${migrationsPath}`)
		
		// Run migrations
		const migrations = await migrate({ client }, migrationsPath)
		
		if (migrations.length === 0) {
			console.log('⚠️  No migrations found or applied')
		} else {
			migrations.forEach((migration) => {
				console.log(`✅ Applied migration: ${migration.fileName}`)
			})
		}

		console.log('🎉 Database reset completed successfully!')
		console.log('')
		console.log('💡 Next steps:')
		console.log('   • Run "npm run dev" to start the development server')
		console.log('   • Visit http://localhost:5173/api/migrate to verify migrations')
		console.log('   • Check http://localhost:5173/api/content-status for content table status')

	} catch (error) {
		console.error('❌ Error resetting database:', error)
		console.log('')
		console.log('🔧 Troubleshooting tips:')
		console.log('   • Make sure PostgreSQL is running (docker-compose up)')
		console.log('   • Check that PostgreSQL is available on localhost:5432')
		console.log('   • Verify database credentials (admin/admin) and permissions')
		process.exit(1)
	} finally {
		await client.end()
	}
}

// Add safety check for production
if (process.env.NODE_ENV === 'production') {
	console.error('❌ Database reset is not allowed in production!')
	console.log('This command will destroy all data. Only run in development.')
	process.exit(1)
}

// Run the script
clearAndRecreateDatabase()
