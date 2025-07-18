/**
 * Unified path utilities for handling documentation paths
 */

/**
 * Clean a path by removing the "apps/svelte.dev/content/" prefix
 * This is used to convert database paths to display paths
 * 
 * @param path - The path to clean
 * @returns The cleaned path
 */
export function cleanDocumentationPath(path: string): string {
	const prefix = 'apps/svelte.dev/content/'
	if (path.startsWith(prefix)) {
		return path.substring(prefix.length)
	}
	return path
}

/**
 * Clean a tarball path by removing the repository directory prefix (first segment)
 * This is used when processing files from GitHub tarballs
 * 
 * @param path - The path to clean
 * @returns The cleaned path without the repo directory prefix
 */
export function cleanTarballPath(path: string): string {
	// Remove only the repo directory prefix (first segment)
	return path.split('/').slice(1).join('/')
}

/**
 * Extract the title from a file path by removing prefixes and file extensions
 * 
 * @param filePath - The file path to extract title from
 * @returns The extracted title
 */
export function extractTitleFromPath(filePath: string): string {
	const filename = filePath.split('/').pop() || filePath
	return filename.replace('.md', '').replace(/^\d+-/, '')
}
