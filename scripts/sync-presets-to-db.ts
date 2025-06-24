#!/usr/bin/env node

/**
 * Script to sync all existing presets to the database
 * Run with: npx tsx scripts/sync-presets-to-db.ts
 */

import { presets } from '../src/lib/presets'
import { PresetDbService } from '../src/lib/server/presetDb'
import { disconnect } from '../src/lib/server/db'
import type { CreatePresetInput } from '../src/lib/types/db'
import { config } from 'dotenv'

// Load environment variables
config()

async function syncPresetsToDatabase() {
	console.log('🚀 Starting preset synchronization to database...')

	try {
		let successCount = 0
		let errorCount = 0

		// Process each preset
		for (const [key, preset] of Object.entries(presets)) {
			try {
				console.log(`\n📦 Processing preset: ${key}`)

				// Convert to database input format
				const presetInput: CreatePresetInput = {
					key,
					title: preset.title,
					description: preset.description,
					owner: preset.owner,
					repo: preset.repo,
					glob: preset.glob,
					ignore_patterns: preset.ignore,
					prompt: preset.prompt,
					minimize_options: preset.minimize,
					is_distilled: preset.distilled,
					distilled_filename_base: preset.distilledFilenameBase
				}

				// Sync to database
				const dbPreset = await PresetDbService.syncPreset(presetInput)
				console.log(`✅ Successfully synced preset: ${key} (ID: ${dbPreset.id})`)
				successCount++

				// Optional: Fetch and sync documents for non-distilled presets
				if (!preset.distilled) {
					console.log(`   Fetching documents for ${key}...`)
					try {
						// Import the fetch function dynamically to avoid circular dependencies
						const { fetchMarkdownFiles } = await import('../src/lib/fetchMarkdownWithDb')
						const filesWithPaths = (await fetchMarkdownFiles(preset, true)) as Array<{
							path: string
							content: string
						}>

						if (filesWithPaths.length > 0) {
							await PresetDbService.syncDocuments(dbPreset.id, filesWithPaths)
							console.log(`   📄 Synced ${filesWithPaths.length} documents`)
						}
					} catch (fetchError) {
						console.error(
							`   ⚠️  Failed to fetch documents: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
						)
					}
				}
			} catch (error) {
				console.error(`❌ Failed to sync preset ${key}:`, error)
				errorCount++
			}
		}

		console.log('\n📊 Synchronization Summary:')
		console.log(`   ✅ Successful: ${successCount}`)
		console.log(`   ❌ Failed: ${errorCount}`)
		console.log(`   📦 Total: ${Object.keys(presets).length}`)

		// Get and display overall statistics
		try {
			const summaries = await PresetDbService.getAllPresetSummaries()
			console.log('\n📈 Database Statistics:')
			console.log(`   Total presets: ${summaries.length}`)
			console.log(`   Distilled presets: ${summaries.filter((s) => s.is_distilled).length}`)
			console.log(`   Regular presets: ${summaries.filter((s) => !s.is_distilled).length}`)
		} catch (statsError) {
			console.error('Failed to fetch statistics:', statsError)
		}
	} catch (error) {
		console.error('Fatal error during synchronization:', error)
		process.exit(1)
	} finally {
		// Disconnect from database
		await disconnect()
		console.log('\n✨ Database connection closed')
	}
}

// Run the sync
syncPresetsToDatabase()
	.then(() => {
		console.log('\n🎉 Preset synchronization completed!')
		process.exit(0)
	})
	.catch((error) => {
		console.error('\n💥 Synchronization failed:', error)
		process.exit(1)
	})
