import { ContentDbService } from '$lib/server/contentDb'
import type { DbContent } from '$lib/types/db'
import { logAlways, logErrorAlways, log } from '$lib/log'
import { cleanDocumentationPath, extractTitleFromPath } from '$lib/utils/pathUtils'

function getTitleFromMetadata(
	metadata: Record<string, unknown> | undefined,
	fallbackPath: string
): string {
	if (metadata?.title && typeof metadata.title === 'string') {
		return metadata.title
	}
	return extractTitleFromPath(fallbackPath)
}

async function searchSectionInDb(query: string): Promise<DbContent | null> {
	const lowerQuery = query.toLowerCase()

	const allContent = await ContentDbService.getContentByFilter({
		owner: 'sveltejs',
		repo_name: 'svelte.dev',
		path_pattern: 'apps/svelte.dev/content/docs/%'
	})

	// First try exact title match
	let match = allContent.find((item) => {
		const title = getTitleFromMetadata(item.metadata, item.path)
		return title.toLowerCase() === lowerQuery
	})
	if (match) return match

	// Then try partial title match
	match = allContent.find((item) => {
		const title = getTitleFromMetadata(item.metadata, item.path)
		return title.toLowerCase().includes(lowerQuery)
	})
	if (match) return match

	// Finally try file path match for backward compatibility
	match = allContent.find((item) => item.path.toLowerCase().includes(lowerQuery))
	if (match) return match

	return null
}

export const getDocumentationHandler = async ({ section }: { section: string | string[] }) => {
	try {
		// Handle array of sections - including JSON string arrays
		let sections: string[]
		if (Array.isArray(section)) {
			sections = section
		} else if (
			typeof section === 'string' &&
			section.trim().startsWith('[') &&
			section.trim().endsWith(']')
		) {
			// Try to parse JSON string array
			try {
				const parsed = JSON.parse(section)
				sections = Array.isArray(parsed) ? parsed : [section]
			} catch {
				sections = [section]
			}
		} else {
			sections = [section]
		}

		const results: string[] = []
		const notFound: string[] = []

		for (const sectionName of sections) {
			log({ section: sectionName })

			// Remove trailing comma if present
			const cleanSection = sectionName.replace(/,\s*$/, '')

			const matchedContent = await searchSectionInDb(cleanSection)

			if (matchedContent) {
				const cleanedPath = cleanDocumentationPath(matchedContent.path)

				const formattedContent = `## ${cleanedPath}\n\n${matchedContent.content}`
				const framework = matchedContent.path.includes('/docs/svelte/') ? 'Svelte' : 'SvelteKit'

				const title = getTitleFromMetadata(matchedContent.metadata, matchedContent.path)
				results.push(`📖 ${framework} documentation (${title}):\n\n${formattedContent}`)
			} else {
				notFound.push(cleanSection)
			}
		}

		if (results.length === 0) {
			const sectionList = Array.isArray(section) ? section.join(', ') : section
			return {
				content: [
					{
						type: 'text' as const,
						text: `❌ Section(s) "${sectionList}" not found in Svelte or SvelteKit documentation. Use list_sections to see all available sections.`
					}
				]
			}
		}

		let responseText = results.join('\n\n---\n\n')

		if (notFound.length > 0) {
			responseText += `\n\n---\n\n❌ The following sections were not found: ${notFound.join(', ')}`
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: responseText
				}
			]
		}
	} catch (error) {
		logErrorAlways('Error fetching documentation:', error)
		const sectionList = Array.isArray(section) ? section.join(', ') : section
		return {
			content: [
				{
					type: 'text' as const,
					text: `❌ Error fetching documentation for section(s) "${sectionList}": ${error instanceof Error ? error.message : String(error)}`
				}
			]
		}
	}
}
