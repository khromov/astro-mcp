// Types
import type { RequestHandler } from './$types'

// Utils
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { dev } from '$app/environment'
import { fetchAndProcessMarkdownWithDb } from '$lib/fetchMarkdown'
import { readFile } from 'fs/promises'
import { getPresetContent, isPresetStale } from '$lib/presetCache'
import { env } from '$env/dynamic/private'

// Valid virtual presets that aren't in the presets object
const VIRTUAL_DISTILLED_PRESETS = ['svelte-distilled', 'sveltekit-distilled']

/**
 * Trigger a background update for a preset without awaiting the result
 */
function triggerBackgroundUpdate(presetKey: string): void {
	const preset = presets[presetKey]
	if (!preset) return

	// Don't update distilled presets, they have their own update mechanism
	if (preset.distilled) return

	// Fire and forget - don't await this promise
	fetchAndProcessMarkdownWithDb(preset, presetKey)
		.then(() => {
			if (dev) console.log(`Background update completed for ${presetKey}`)
		})
		.catch((err) => {
			console.error(`Background update failed for ${presetKey}:`, err)
		})
}

export const GET: RequestHandler = async ({ params, url }) => {
	const presetNames = params.preset.split(',').map((p) => p.trim())

	if (dev) {
		console.log(`Received request for presets: ${presetNames.join(', ')}`)
	}

	// Validate all preset names first
	const invalidPresets = presetNames.filter(
		(name) => !(name in presets) && !VIRTUAL_DISTILLED_PRESETS.includes(name)
	)

	if (invalidPresets.length > 0) {
		error(400, `Invalid preset(s): "${invalidPresets.join('", "')}"`)
	}

	try {
		// Determine which version of the distilled doc to use
		const version = url.searchParams.get('version')

		// Fetch all contents in parallel
		const contentPromises = presetNames.map(async (presetKey) => {
			if (dev) {
				console.time('dataFetching')
			}

			let content

			// Handle both regular distilled presets and virtual ones
			if (presets[presetKey]?.distilled || VIRTUAL_DISTILLED_PRESETS.includes(presetKey)) {
				// For virtual presets, use their basename directly
				const baseFilename = presets[presetKey]?.distilledFilenameBase || presetKey
				let filename

				if (version) {
					// Use specific version if provided
					filename = `outputs/${baseFilename}-${version}.md`
				} else {
					// Use latest version otherwise
					filename = `outputs/${baseFilename}-latest.md`
				}

				try {
					content = await readFile(filename, 'utf-8')
				} catch (e) {
					throw new Error(
						`Failed to read distilled content: ${e instanceof Error ? e.message : String(e)}. Make sure to run the distillation process first.`
					)
				}
			} else {
				// Regular preset processing with database-only caching
				content = await getPresetContent(presetKey)

				if (content) {
					// Check if the content is stale and needs a background update
					const isStale = await isPresetStale(presetKey)
					if (isStale) {
						if (dev) console.log(`Content for ${presetKey} is stale, triggering background update`)
						triggerBackgroundUpdate(presetKey)
					}
				} else {
					// If not in database cache, fetch and process markdown (database-only)
					content = await fetchAndProcessMarkdownWithDb(presets[presetKey], presetKey)
				}
			}

			if (dev) {
				console.timeEnd('dataFetching')
				console.log(`Content length for ${presetKey}: ${content.length}`)
			}

			if (content.length === 0) {
				throw new Error(`No content found for ${presetKey}`)
			}

			// Add the prompt if it exists and we're not using a distilled preset
			// (distilled presets already have the prompt added)
			return !presets[presetKey]?.distilled &&
				!VIRTUAL_DISTILLED_PRESETS.includes(presetKey) &&
				presets[presetKey]?.prompt
				? `${content}\n\nInstructions for LLMs: <SYSTEM>${presets[presetKey].prompt}</SYSTEM>`
				: content
		})

		const contents = await Promise.all(contentPromises)

		// Join all contents with a delimiter
		const response = contents.join('\n\n---\n\n')

		if (dev) {
			console.log(`Final combined response length: ${response.length}`)
		}

		const headers: HeadersInit = {
			'Content-Type': 'text/plain; charset=utf-8'
		}

		// Serve as a download if not in development mode
		if (!dev) {
			headers['Content-Disposition'] = `attachment; filename="${presetNames.join('-')}.txt"`
		}

		return new Response(response, {
			status: 200,
			headers
		})
	} catch (e) {
		console.error(`Error fetching documentation for presets [${presetNames.join(', ')}]:`, e)
		error(500, `Failed to fetch documentation for presets "${presetNames.join(', ')}"`)
	}
}
