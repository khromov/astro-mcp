import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { dev } from '$app/environment'
import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { presets } from '$lib/presets'
import { fetchMarkdownFiles } from '$lib/fetchMarkdown'
import type { RequestHandler } from './$types'
import {
	AnthropicProvider,
	type AnthropicBatchRequest,
	type AnthropicBatchResult
} from '$lib/anthropic'

// Ensure output directory exists
async function ensureDir(path: string) {
	try {
		await mkdir(dirname(path), { recursive: true })
	} catch (e) {
		// Ignore if directory already exists
		if (dev && !(e instanceof Error && 'code' in e && e.code === 'EEXIST')) {
			console.error(`Error creating directory: ${e}`)
		}
	}
}

const DISTILLATION_PROMPT = `
You are an expert in web development, specifically Svelte 5 and SvelteKit. Your task is to condense this documentation into a more concise format while preserving the most important information.

Focus on:
1. Code examples with explanations of how they work
2. Key concepts and APIs with their usage patterns
3. Important gotchas and best practices
4. Patterns that developers commonly use

Remove:
1. Redundant explanations
2. Verbose content that can be simplified
3. Marketing language
4. Legacy or deprecated content

Keep your output in markdown format. Preserve code blocks with their language annotations.
Maintain headings but feel free to combine or restructure sections to improve clarity.

IMPORTANT: Make sure all code examples use Svelte 5 runes syntax ($state, $derived, $effect, etc.) and NOT Svelte 4 reactivity syntax (writable, readable, derived, stores). Always use Svelte 5 syntax in your examples.

Here is the documentation to condense:

`

export const GET: RequestHandler = async ({ url }) => {
	// Check secret key
	const secretKey = url.searchParams.get('secret_key')
	const envSecretKey = env.DISTILL_SECRET_KEY

	if (!envSecretKey) {
		throw error(500, 'Server is not configured for distillation (DISTILL_SECRET_KEY not set)')
	}

	if (secretKey !== envSecretKey) {
		throw error(403, 'Invalid secret key')
	}

	// Find the distilled preset
	const distilledPreset = Object.values(presets).find((preset) => preset.distilled)

	if (!distilledPreset) {
		throw error(500, 'No distilled preset found')
	}

	try {
		// Fetch all markdown files for the preset
		let files = await fetchMarkdownFiles(distilledPreset)

		// Filter out files that are too short (less than 200 characters)
		const originalFileCount = files.length
		files = files.filter((file) => file.length >= 200)

		if (dev) {
			console.log(
				`Filtered out ${originalFileCount - files.length} files that were too short (< 200 chars)`
			)
		}

		// DEBUG: Limit to first 10 files
		files = files.slice(0, 10)

		if (dev) {
			console.log(`Using ${files.length} files for distillation (limited to 10 for debugging)`)
		}

		// Initialize Anthropic client
		const anthropic = new AnthropicProvider()

		// Create debug structure to store inputs and outputs
		const debugData = {
			timestamp: new Date().toISOString(),
			model: anthropic.getModelIdentifier(),
			requests: [] as Array<{
				index: number
				originalContent: string
				fullPrompt: string
				response?: string
				error?: string
			}>
		}

		// Prepare batch requests
		const batchRequests: AnthropicBatchRequest[] = files.map((file, index) => {
			const fullPrompt = DISTILLATION_PROMPT + file

			// Store input for debugging
			debugData.requests.push({
				index,
				originalContent: file,
				fullPrompt
			})

			return {
				custom_id: `file-${index}`,
				params: {
					model: anthropic.getModelIdentifier(),
					max_tokens: 8192,
					messages: [
						{
							role: 'user',
							content: fullPrompt
						}
					],
					temperature: 0 // Low temperature for consistent results
				}
			}
		})

		// Create batch
		const batchResponse = await anthropic.createBatch(batchRequests)

		// Poll for completion
		let batchStatus = await anthropic.getBatchStatus(batchResponse.id)

		while (batchStatus.processing_status === 'in_progress') {
			await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds before polling again
			batchStatus = await anthropic.getBatchStatus(batchResponse.id)

			if (dev) {
				console.log(
					`Batch status: ${batchStatus.processing_status}, Succeeded: ${batchStatus.request_counts.succeeded}, Processing: ${batchStatus.request_counts.processing}`
				)
			}
		}

		// Get results
		if (!batchStatus.results_url) {
			throw error(500, 'Batch completed but no results URL available')
		}

		const results = await anthropic.getBatchResults(batchStatus.results_url)

		// Process results
		const processedResults = results
			.filter((result) => result.result.type === 'succeeded')
			.map((result) => {
				const index = parseInt(result.custom_id.split('-')[1])

				if (result.result.type !== 'succeeded' || !result.result.message) {
					// Update debug data with error
					const debugEntry = debugData.requests.find((r) => r.index === index)
					if (debugEntry) {
						debugEntry.error = result.result.error?.message || 'Failed or no message'
					}

					return {
						index,
						content: '',
						error: 'Failed or no message'
					}
				}

				const outputContent = result.result.message.content[0].text

				// Update debug data with response
				const debugEntry = debugData.requests.find((r) => r.index === index)
				if (debugEntry) {
					debugEntry.response = outputContent
				}

				return {
					index,
					content: outputContent
				}
			})

		// Sort by index to maintain original order
		processedResults.sort((a, b) => a.index - b.index)

		// Extract just the content
		const distilledContent = processedResults
			.filter((result) => result.content) // Only include successful responses
			.map((result) => result.content)
			.join('\n\n')

		// Add the prompt if it exists
		const finalContent = distilledPreset.prompt
			? `${distilledContent}\n\nInstructions for LLMs: <SYSTEM>${distilledPreset.prompt}</SYSTEM>`
			: distilledContent

		// Generate filenames
		const today = new Date()
		const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
			today.getDate()
		).padStart(2, '0')}`

		const latestFilename = `outputs/${distilledPreset.distilledFilenameBase}-latest.md`
		const datedFilename = `outputs/${distilledPreset.distilledFilenameBase}-${dateStr}.md`
		const debugFilename = `outputs/${distilledPreset.distilledFilenameBase}-debug.json`

		// Ensure directories exist
		await ensureDir(latestFilename)

		// Write files
		await writeFile(latestFilename, finalContent)
		await writeFile(datedFilename, finalContent)
		await writeFile(debugFilename, JSON.stringify(debugData, null, 2))

		return json({
			success: true,
			totalFiles: originalFileCount,
			filesUsed: files.length,
			resultsReceived: results.length,
			successfulResults: processedResults.filter((r) => r.content).length,
			bytes: finalContent.length,
			latestFile: latestFilename,
			datedFile: datedFilename,
			debugFile: debugFilename
		})
	} catch (e) {
		console.error('Error in distillation process:', e)
		throw error(500, `Distillation failed: ${e instanceof Error ? e.message : String(e)}`)
	}
}
