#!/usr/bin/env node

/**
 * Script to sync all existing presets to the simplified database
 * Run with: npx tsx scripts/sync-presets-to-db.ts
 */

import { presets } from '../src/lib/presets'
import { PresetDbService } from '../src/lib/server/presetDb'
import { disconnect } from '../src/lib/server/db'
import { config } from 'dotenv'

// Load environment variables
config()

async function syncPresetsToDatabase() {
	console.log('🚀 Starting preset synchronization to simplified database...')

	try {
		let successCount = 0
		let errorCount = 0

		// Process each preset
		for (const [key, preset] of Object.entries(presets)) {
			try {
				console.log(`\n📦 Processing preset: ${key}`)

				// For non-distilled presets, we'll need to fetch and store the content
				if (!preset.distilled) {
					console.log(
						`   ⚠️  Preset ${key} is not distilled and will need to be fetched on first request`
					)
					console.log(`   💡 Skipping for now - content will be generated on first access`)
					continue
				}

				// For distilled presets, check if content exists
				const existingPreset = await PresetDbService.getPresetByName(key)
				if (existingPreset) {
					console.log(`   ✅ Distilled preset ${key} already exists in database`)
					successCount++
				} else {
					console.log(
						`   ℹ️  Distilled preset ${key} not found - run distillation process to generate`
					)
				}
			} catch (error) {
				console.error(`❌ Failed to check preset ${key}:`, error)
				errorCount++
			}
		}

		// Also check for virtual distilled presets
		const virtualPresets = ['svelte-distilled', 'sveltekit-distilled']
		for (const presetKey of virtualPresets) {
			const existingPreset = await PresetDbService.getPresetByName(presetKey)
			if (existingPreset) {
				console.log(`   ✅ Virtual distilled preset ${presetKey} exists in database`)
				successCount++
			} else {
				console.log(
					`   ℹ️  Virtual distilled preset ${presetKey} not found - run distillation process to generate`
				)
			}
		}

		console.log('\n📊 Synchronization Summary:')
		console.log(`   ✅ Found: ${successCount}`)
		console.log(`   ❌ Failed: ${errorCount}`)
		console.log(`   📦 Total presets in code: ${Object.keys(presets).length}`)

		// Get and display overall statistics
		try {
			const allPresets = await PresetDbService.getAllPresets()
			console.log('\n📈 Database Statistics:')
			console.log(`   Total presets in DB: ${allPresets.length}`)
			console.log(`   Total KB stored: ${allPresets.reduce((sum, p) => sum + p.size_kb, 0)}`)

			console.log('\n📋 Presets in database:')
			for (const preset of allPresets) {
				console.log(
					`   - ${preset.preset_name} (${preset.size_kb}KB, ${preset.document_count} docs, updated: ${preset.updated_at})`
				)
			}
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
		console.log('\n🎉 Preset synchronization check completed!')
		process.exit(0)
	})
	.catch((error) => {
		console.error('\n💥 Synchronization failed:', error)
		process.exit(1)
	})
