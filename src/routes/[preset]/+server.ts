// Types
import type { RequestHandler } from './$types'

// Utils
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { dev } from '$app/environment'
import { fetchAndProcessMarkdownWithDb } from '$lib/fetchMarkdown'
import { getPresetContent } from '$lib/presetCache'
import { PresetDbService } from '$lib/server/presetDb'
import { log, logError } from '$lib/log'

// Valid virtual presets that aren't in the presets object
const VIRTUAL_DISTILLED_PRESETS = ['svelte-distilled', 'sveltekit-distilled']

// Background updates are now handled by the scheduler service
// This function is kept for backwards compatibility but is no longer used

export const GET: RequestHandler = async ({ params, url }) => {
	const presetNames = params.preset.split(',').map((p) => p.trim())

	log(`Received request for presets: ${presetNames.join(', ')}`)

	// Validate all preset names first
	const invalidPresets = presetNames.filter(
		(name) => !(name in presets) && !VIRTUAL_DISTILLED_PRESETS.includes(name)
	)

	if (invalidPresets.length > 0) {
		error(400, `Invalid preset(s): "${invalidPresets.join('", "')}"`)
	}

	try {
		// Determine which version of the distilled doc to use
		const version = url.searchParams.get('version') || 'latest'

		// Fetch all contents in parallel
		const contentPromises = presetNames.map(async (presetKey) => {
			if (dev) {
				console.time('dataFetching')
			}

			let content

			// Handle both regular distilled presets and virtual ones
			if (presets[presetKey]?.distilled || VIRTUAL_DISTILLED_PRESETS.includes(presetKey)) {
				// For distilled presets, fetch from distillations table
				const dbDistillation = await PresetDbService.getDistillationByVersion(presetKey, version)

				if (!dbDistillation || !dbDistillation.content) {
					throw new Error(
						`Failed to read distilled content for ${presetKey} version ${version}. Make sure to run the distillation process first.`
					)
				}

				content = dbDistillation.content
			} else {
				// Regular preset processing with database caching
				content = await getPresetContent(presetKey)

				if (!content) {
					// If not in database cache, fetch and process markdown
					content = await fetchAndProcessMarkdownWithDb(presets[presetKey], presetKey)
				}
				// Note: Staleness checks and background updates are now handled by the scheduler service
			}

			if (dev) {
				console.timeEnd('dataFetching')
			}
			log(`Content length for ${presetKey}: ${content.length}`)

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

		log(`Final combined response length: ${response.length}`)

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
		logError(`Error fetching documentation for presets [${presetNames.join(', ')}]:`, e)
		error(500, `Failed to fetch documentation for presets "${presetNames.join(', ')}"`)
	}
}
