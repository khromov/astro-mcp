import { query } from '$lib/server/db'
import type {
	DbContent,
	CreateContentInput,
	UpdateContentInput,
	ContentFilter,
	ContentStats,
	RepoString
} from '$lib/types/db'
import { logAlways, logErrorAlways } from '$lib/log'
import { createHash } from 'crypto'

export class ContentDbService {
	/**
	 * Calculate SHA-256 hash of content (utility function, not stored in DB)
	 */
	static calculateContentHash(content: string): string {
		return createHash('sha256').update(content).digest('hex')
	}

	/**
	 * Extract filename from path
	 */
	static extractFilename(path: string): string {
		return path.split('/').pop() || path
	}

	/**
	 * Extract file extension from filename or path
	 */
	static extractExtension(filenameOrPath: string): string {
		const filename = filenameOrPath.includes('/')
			? ContentDbService.extractFilename(filenameOrPath)
			: filenameOrPath
		const parts = filename.split('.')
		return parts.length > 1 ? parts.pop()! : ''
	}

	/**
	 * Combine owner and repo_name into repo string
	 */
	static getRepoString(owner: string, repo_name: string): RepoString {
		return `${owner}/${repo_name}` as RepoString
	}

	/**
	 * Split repo string into owner and repo_name
	 */
	static splitRepoString(repo: RepoString): { owner: string; repo_name: string } {
		const [owner, repo_name] = repo.split('/')
		return { owner, repo_name }
	}

	/**
	 * Create or update content
	 */
	static async upsertContent(input: CreateContentInput): Promise<DbContent> {
		try {
			const result = await query(
				`INSERT INTO content (
					owner, repo_name, path, filename,
					content, size_bytes, metadata
				) VALUES ($1, $2, $3, $4, $5, $6, $7)
				ON CONFLICT (owner, repo_name, path) DO UPDATE SET
					content = EXCLUDED.content,
					size_bytes = EXCLUDED.size_bytes,
					metadata = EXCLUDED.metadata,
					updated_at = CURRENT_TIMESTAMP
				RETURNING *`,
				[
					input.owner,
					input.repo_name,
					input.path,
					input.filename,
					input.content,
					input.size_bytes,
					input.metadata ? JSON.stringify(input.metadata) : '{}'
				]
			)

			logAlways(`Upserted content for ${input.owner}/${input.repo_name}/${input.path}`)
			return result.rows[0] as DbContent
		} catch (error) {
			logErrorAlways(
				`Failed to upsert content for ${input.owner}/${input.repo_name}/${input.path}:`,
				error
			)
			throw new Error(
				`Failed to upsert content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get content by owner, repo_name and path
	 */
	static async getContentByPath(
		owner: string,
		repo_name: string,
		path: string
	): Promise<DbContent | null> {
		try {
			const result = await query(
				'SELECT * FROM content WHERE owner = $1 AND repo_name = $2 AND path = $3',
				[owner, repo_name, path]
			)
			return result.rows.length > 0 ? (result.rows[0] as DbContent) : null
		} catch (error) {
			logErrorAlways(`Failed to get content ${owner}/${repo_name}/${path}:`, error)
			throw new Error(
				`Failed to get content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get all content for a repository
	 */
	static async getContentByRepo(owner: string, repo_name: string): Promise<DbContent[]> {
		try {
			const result = await query(
				'SELECT * FROM content WHERE owner = $1 AND repo_name = $2 ORDER BY path',
				[owner, repo_name]
			)
			return result.rows as DbContent[]
		} catch (error) {
			logErrorAlways(`Failed to get content for repo ${owner}/${repo_name}:`, error)
			throw new Error(
				`Failed to get content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get content matching filter criteria
	 */
	static async getContentByFilter(filter: ContentFilter): Promise<DbContent[]> {
		try {
			const conditions: string[] = []
			const params: any[] = []
			let paramCount = 1

			if (filter.owner) {
				conditions.push(`owner = $${paramCount}`)
				params.push(filter.owner)
				paramCount++
			}

			if (filter.repo_name) {
				conditions.push(`repo_name = $${paramCount}`)
				params.push(filter.repo_name)
				paramCount++
			}

			if (filter.is_processed !== undefined) {
				conditions.push(`is_processed = $${paramCount}`)
				params.push(filter.is_processed)
				paramCount++
			}

			if (filter.path_pattern) {
				conditions.push(`path LIKE $${paramCount}`)
				params.push(filter.path_pattern.replace('*', '%'))
				paramCount++
			}

			const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
			const queryStr = `SELECT * FROM content ${whereClause} ORDER BY owner, repo_name, path`

			const result = await query(queryStr, params)
			return result.rows as DbContent[]
		} catch (error) {
			logErrorAlways('Failed to get content by filter:', error)
			throw new Error(
				`Failed to get content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Mark content as processed
	 */
	static async markContentAsProcessed(
		owner: string,
		repo_name: string,
		path: string,
		metadata?: Record<string, any>
	): Promise<DbContent> {
		try {
			const result = await query(
				`UPDATE content SET
					is_processed = true,
					processed_at = CURRENT_TIMESTAMP,
					metadata = COALESCE($4, metadata),
					updated_at = CURRENT_TIMESTAMP
				WHERE owner = $1 AND repo_name = $2 AND path = $3
				RETURNING *`,
				[owner, repo_name, path, metadata ? JSON.stringify(metadata) : null]
			)

			if (result.rows.length === 0) {
				throw new Error(`Content not found: ${owner}/${repo_name}/${path}`)
			}

			return result.rows[0] as DbContent
		} catch (error) {
			logErrorAlways(`Failed to mark content as processed ${owner}/${repo_name}/${path}:`, error)
			throw new Error(
				`Failed to update content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get content statistics
	 */
	static async getContentStats(): Promise<ContentStats> {
		try {
			// Get total stats
			const totalResult = await query(
				`SELECT 
					COUNT(*) as total_files,
					COALESCE(SUM(size_bytes), 0) as total_size_bytes,
					MAX(updated_at) as last_updated
				FROM content`
			)

			// Get stats by repo
			const repoResult = await query(
				`SELECT 
					owner || '/' || repo_name as repo,
					COUNT(*) as files,
					COALESCE(SUM(size_bytes), 0) as size_bytes
				FROM content
				GROUP BY owner, repo_name
				ORDER BY owner, repo_name`
			)

			const byRepo: Record<string, { files: number; size_bytes: number }> = {}
			for (const row of repoResult.rows) {
				byRepo[row.repo] = {
					files: parseInt(row.files),
					size_bytes: parseInt(row.size_bytes)
				}
			}

			return {
				total_files: parseInt(totalResult.rows[0].total_files),
				total_size_bytes: parseInt(totalResult.rows[0].total_size_bytes),
				by_repo: byRepo,
				last_updated: totalResult.rows[0].last_updated
			}
		} catch (error) {
			logErrorAlways('Failed to get content stats:', error)
			throw new Error(
				`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Delete content by owner, repo_name and path
	 */
	static async deleteContent(owner: string, repo_name: string, path: string): Promise<boolean> {
		try {
			const result = await query(
				'DELETE FROM content WHERE owner = $1 AND repo_name = $2 AND path = $3',
				[owner, repo_name, path]
			)
			return (result.rowCount ?? 0) > 0
		} catch (error) {
			logErrorAlways(`Failed to delete content ${owner}/${repo_name}/${path}:`, error)
			throw new Error(
				`Failed to delete content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Delete all content for a repository
	 */
	static async deleteRepoContent(owner: string, repo_name: string): Promise<number> {
		try {
			const result = await query('DELETE FROM content WHERE owner = $1 AND repo_name = $2', [
				owner,
				repo_name
			])
			return result.rowCount ?? 0
		} catch (error) {
			logErrorAlways(`Failed to delete content for repo ${owner}/${repo_name}:`, error)
			throw new Error(
				`Failed to delete content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Check if content has changed (comparing with existing content)
	 */
	static async hasContentChanged(
		owner: string,
		repo_name: string,
		path: string,
		newContent: string
	): Promise<boolean> {
		try {
			const existing = await ContentDbService.getContentByPath(owner, repo_name, path)
			if (!existing) return true // New content

			// Simple comparison - you could also use hash comparison if needed
			return existing.content !== newContent
		} catch (error) {
			logErrorAlways(`Failed to check content change for ${owner}/${repo_name}/${path}:`, error)
			return true // Assume changed on error
		}
	}

	/**
	 * Batch upsert content
	 */
	static async batchUpsertContent(contents: CreateContentInput[]): Promise<DbContent[]> {
		try {
			const results: DbContent[] = []

			// Process in chunks to avoid overwhelming the database
			const chunkSize = 100
			for (let i = 0; i < contents.length; i += chunkSize) {
				const chunk = contents.slice(i, i + chunkSize)

				// Use Promise.all for parallel processing within each chunk
				const chunkResults = await Promise.all(
					chunk.map((content) => ContentDbService.upsertContent(content))
				)

				results.push(...chunkResults)
			}

			logAlways(`Batch upserted ${results.length} content items`)
			return results
		} catch (error) {
			logErrorAlways('Failed to batch upsert content:', error)
			throw new Error(
				`Failed to batch upsert: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Extract frontmatter metadata from content
	 */
	static extractFrontmatter(content: string): Record<string, any> {
		const metadata: Record<string, any> = {}

		if (!content.startsWith('---\n')) {
			return metadata
		}

		const endIndex = content.indexOf('\n---\n', 4)
		if (endIndex === -1) {
			return metadata
		}

		const frontmatter = content.substring(4, endIndex)
		const lines = frontmatter.split('\n')

		for (const line of lines) {
			const colonIndex = line.indexOf(':')
			if (colonIndex > 0) {
				const key = line.substring(0, colonIndex).trim()
				const value = line.substring(colonIndex + 1).trim()

				// Remove quotes if present
				const cleanValue = value.replace(/^["'](.*)["']$/, '$1')

				// Try to parse as JSON for nested structures
				try {
					metadata[key] = JSON.parse(cleanValue)
				} catch {
					// If not valid JSON, use as string
					metadata[key] = cleanValue
				}
			}
		}

		return metadata
	}

	/**
	 * Get content by extension(s) for a repository
	 */
	static async getContentByExtension(
		owner: string,
		repo_name: string,
		extensions: string | string[]
	): Promise<DbContent[]> {
		try {
			const extensionArray = Array.isArray(extensions) ? extensions : [extensions]
			const content = await ContentDbService.getContentByRepo(owner, repo_name)

			return content.filter((item) => {
				const ext = ContentDbService.extractExtension(item.filename)
				return extensionArray.includes(ext)
			})
		} catch (error) {
			logErrorAlways(`Failed to get content by extension for ${owner}/${repo_name}:`, error)
			throw new Error(
				`Failed to get content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}
}
