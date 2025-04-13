import { writeFile, readFile, rename, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname } from 'path'
import { dev } from '$app/environment'

/**
 * Ensure a directory exists before writing to it
 */
export async function ensureDir(path: string): Promise<void> {
	try {
		await mkdir(dirname(path), { recursive: true })
	} catch (e) {
		// Ignore if directory already exists
		if (!(e instanceof Error && 'code' in e && e.code === 'EEXIST')) {
			console.error(`Error creating directory: ${e}`)
		}
	}
}

/**
 * Write content atomically by writing to a temp file first, then renaming
 */
export async function writeAtomicFile(path: string, content: string): Promise<void> {
	const tempPath = `${path}.temp`

	await ensureDir(path)

	try {
		// Write to temp file
		await writeFile(tempPath, content)

		// Rename temp file to target path (atomic operation)
		await rename(tempPath, path)

		if (dev) {
			console.log(`Successfully wrote file: ${path}`)
		}
	} catch (e) {
		console.error(`Error writing file ${path}:`, e)
		throw e
	}
}

/**
 * Read file content
 */
export async function readCachedFile(path: string): Promise<string | null> {
	try {
		if (existsSync(path)) {
			return await readFile(path, 'utf-8')
		}
		return null
	} catch (e) {
		console.error(`Error reading file ${path}:`, e)
		return null
	}
}

/**
 * Get file path in outputs directory for a preset
 */
export function getPresetFilePath(presetKey: string): string {
	return `outputs/${presetKey}.md`
}

/**
 * Check if a file exists and get its content if it does
 */
export async function getPresetContent(presetKey: string): Promise<string | null> {
	const filePath = getPresetFilePath(presetKey)
	return await readCachedFile(filePath)
}

/**
 * Get file size in KB, returns null if file doesn't exist
 */
export async function getFileSizeKb(path: string): Promise<number | null> {
	try {
		if (existsSync(path)) {
			const content = await readFile(path, 'utf-8')
			return Math.floor(new TextEncoder().encode(content).length / 1024)
		}
		return null
	} catch (e) {
		console.error(`Error getting file size for ${path}:`, e)
		return null
	}
}
