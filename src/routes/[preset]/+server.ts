// Types
import type { RequestHandler } from './$types'

// Utils
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { dev } from '$app/environment'
import { fetchAndProcessMarkdown } from '$lib/fetchMarkdown'
import { readFile } from 'fs/promises'

export const GET: RequestHandler = async ({ params, url }) => {
	const presetNames = params.preset.split(',').map((p) => p.trim())

	if (dev) {
		console.log(`Received request for presets: ${presetNames.join(', ')}`)
	}

	// Validate all preset names first
	const invalidPresets = presetNames.filter((name) => !(name in presets))
	if (invalidPresets.length > 0) {
		error(400, `Invalid preset(s): "${invalidPresets.join('", "')}"`)
	}

	try {
		// Determine which version of the distilled doc to use
		const version = url.searchParams.get('version')

		// Fetch all contents in parallel
		const contentPromises = presetNames.map(async (presetName) => {
			if (dev) {
				console.time('dataFetching')
			}

			let content

			if (presets[presetName]?.distilled) {
				// Handle distilled preset differently
				const baseFilename =
					presets[presetName].distilledFilenameBase || 'svelte-complete-distilled'
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
				// Regular preset processing
				content = await fetchAndProcessMarkdown(presets[presetName])
			}

			if (dev) {
				console.timeEnd('dataFetching')
				console.log(`Content length for ${presetName}: ${content.length}`)
			}

			if (content.length === 0) {
				throw new Error(`No content found for ${presetName}`)
			}

			// Add the prompt if it exists and we're not using a distilled preset
			// (distilled presets already have the prompt added)
			return !presets[presetName]?.distilled && presets[presetName].prompt
				? `${content}\n\nInstructions for LLMs: <SYSTEM>${presets[presetName].prompt}</SYSTEM>`
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
