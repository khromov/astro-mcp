import { ContentDbService } from '$lib/server/contentDb'
import { logAlways, logErrorAlways, log } from '$lib/log'
import { cleanDocumentationPath, extractTitleFromPath } from '$lib/utils/pathUtils'

interface DocumentSection {
	filePath: string
	title: string
	content: string
}

function getTitleFromMetadata(
	metadata: Record<string, unknown> | undefined,
	fallbackPath: string
): string {
	if (metadata?.title && typeof metadata.title === 'string') {
		return metadata.title
	}
	return extractTitleFromPath(fallbackPath)
}

export const listSectionsHandler = async () => {
	logAlways('Listing sections from database')

	try {
		// Use the new efficient method with default parameters
		const dbSections = await ContentDbService.getDocumentationSections()

		const sections: DocumentSection[] = []

		for (const item of dbSections) {
			const title = getTitleFromMetadata(item.metadata, item.path)
			const cleanedPath = cleanDocumentationPath(item.path)

			sections.push({
				filePath: cleanedPath,
				title,
				content: `## ${cleanedPath}\n\n${item.content}`
			})
		}

		sections.sort((a, b) => a.filePath.localeCompare(b.filePath))

		let output = '# Astro Documentation\n'
		output +=
			sections.map((section) => `* title: ${section.title}, path: ${section.filePath}`).join('\n') +
			'\n\n'

		return {
			content: [
				{
					type: 'text' as const,
					text: `📋 Available Astro documentation sections:\n\n${output}\n\nUse get_documentation with a section name to retrieve specific content for a section.`
				}
			]
		}
	} catch (error) {
		logErrorAlways('Error listing sections:', error)
		return {
			content: [
				{
					type: 'text' as const,
					text: `❌ Error listing sections: ${error instanceof Error ? error.message : String(error)}`
				}
			]
		}
	}
}
