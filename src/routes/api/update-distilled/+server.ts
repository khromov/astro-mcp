import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { dev } from '$app/environment'
import { presets } from '$lib/presets'
import { fetchMarkdownFiles, minimizeContent } from '$lib/fetchMarkdown'
import type { RequestHandler } from './$types'
import {
	AnthropicProvider,
	type AnthropicBatchRequest,
	type AnthropicBatchResult
} from '$lib/anthropic'
import { writeAtomicFile } from '$lib/fileCache'

const DISTILLATION_PROMPT = `
You are an expert in web development, specifically Svelte 5 and SvelteKit. Your task is to condense and distill the Svelte documentation into a concise format while preserving the most important information.
Shorten the text information AS MUCH AS POSSIBLE while covering key concepts.

Focus on:
1. Code examples with short explanations of how they work
2. Key concepts and APIs with their usage patterns
3. Important gotchas and best practices
4. Patterns that developers commonly use

Remove:
1. Redundant explanations
2. Verbose content that can be simplified
3. Marketing language
4. Legacy or deprecated content
5. Anything else that is not strictly necessary

Keep your output in markdown format. Preserve code blocks with their language annotations.
Maintain headings but feel free to combine or restructure sections to improve clarity.

Make sure all code examples use Svelte 5 runes syntax ($state, $derived, $effect, etc.)

Keep the following Svelte 5 syntax rules in mind:
* There is no colon (:) in event modifiers. You MUST use "onclick" instead of "on:click".
* Runes do not need to be imported, they are globals. 
* $state() runes are always declared using let, never with const. 
* When passing a function to $derived, you must always use $derived.by(() => ...). 
* Error boundaries can only catch errors during component rendering and at the top level of an $effect inside the error boundary.
* Error boundaries do not catch errors in onclick or other event handlers.

IMPORTANT: All code examples MUST come from the documentation verbatim, do NOT create new code examples. Do NOT modify existing code examples.
IMPORTANT: Because of changes in Svelte 5 syntax, do not include content from your existing knowledge, you may only use knowledge from the documentation to condense.

Here is the documentation you must condense:

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
		// Fetch all markdown files for the preset with their file paths
		const filesWithPaths = await fetchMarkdownFiles(distilledPreset, true)

		// Filter out short files, only keep normal files
		const originalFileCount = filesWithPaths.length
		let filesToProcess = filesWithPaths.filter((file) =>
			typeof file === 'string' ? false : file.content.length >= 200
		)

		if (dev) {
			console.log(`Total files: ${originalFileCount}`)
			console.log(
				`Filtered out ${originalFileCount - filesToProcess.length} short files (< 200 chars)`
			)
			console.log(`Processing ${filesToProcess.length} normal files`)
		}

		if (dev) {
			// DEBUG: Limit to first 10 normal files for debugging
			filesToProcess = filesToProcess.slice(0, 10)
			console.log(
				`Using ${filesToProcess.length} files for LLM distillation (limited to 10 for debugging)`
			)
		}

		// Apply the minimize config to each file's content if the preset has a minimize configuration
		if (distilledPreset.minimize) {
			if (dev) {
				console.log(`Applying minimize configuration before LLM processing`)
			}

			filesToProcess = filesToProcess.map((fileObj) => {
				if (typeof fileObj === 'string') {
					return fileObj // Should not happen with includePathInfo=true
				}

				// Apply minimization to the content
				const minimized = minimizeContent(fileObj.content, distilledPreset.minimize)

				return {
					...fileObj,
					content: minimized
				}
			})

			if (dev) {
				console.log(`Content minimized according to preset configuration`)
			}
		}

		// Initialize Anthropic client
		const anthropic = new AnthropicProvider()

		// Create debug structure to store inputs and outputs
		const debugData = {
			timestamp: new Date().toISOString(),
			model: anthropic.getModelIdentifier(),
			totalFiles: originalFileCount,
			processedFiles: filesToProcess.length,
			shortFilesRemoved: originalFileCount - filesToProcess.length,
			minimizeApplied: !!distilledPreset.minimize,
			requests: [] as Array<{
				index: number
				path: string
				originalContent: string
				fullPrompt: string
				response?: string
				error?: string
			}>
		}

		// Prepare batch requests
		const batchRequests: AnthropicBatchRequest[] = filesToProcess.map((fileObj, index) => {
			const content = typeof fileObj === 'string' ? fileObj : fileObj.content
			const fullPrompt = DISTILLATION_PROMPT + content

			// Store input for debugging
			debugData.requests.push({
				index,
				path: typeof fileObj === 'string' ? 'unknown' : fileObj.path,
				originalContent: typeof fileObj === 'string' ? fileObj : fileObj.content,
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
				const fileObj = filesToProcess[index]

				if (result.result.type !== 'succeeded' || !result.result.message) {
					// Update debug data with error
					const debugEntry = debugData.requests.find((r) => r.index === index)
					if (debugEntry) {
						debugEntry.error = result.result.error?.message || 'Failed or no message'
					}

					return {
						index,
						path: typeof fileObj === 'string' ? 'unknown' : fileObj.path,
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
					path: typeof fileObj === 'string' ? 'unknown' : fileObj.path,
					content: outputContent
				}
			})

		// Sort by index to maintain original order
		processedResults.sort((a, b) => a.index - b.index)

		// Create final content with all successfully processed files
		const contentParts = processedResults
			.filter((result) => result.content) // Only include successful responses
			.map((result) => `## ${result.path}\n\n${result.content}`)

		// Join all parts
		const distilledContent = contentParts.join('\n\n')

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

		// Write files using writeAtomicFile from fileCache.ts
		// Note: writeAtomicFile handles directory creation, so we don't need separate ensureDir calls
		await writeAtomicFile(latestFilename, finalContent)
		await writeAtomicFile(datedFilename, finalContent)
		await writeAtomicFile(debugFilename, JSON.stringify(debugData, null, 2))

		return json({
			success: true,
			totalFiles: originalFileCount,
			shortFilesRemoved: originalFileCount - filesToProcess.length,
			filesProcessed: filesToProcess.length,
			minimizeApplied: !!distilledPreset.minimize,
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
