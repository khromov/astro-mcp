import { query } from '$lib/server/db'
import type {
	DbContent,
	CreateContentInput,
	ContentFilter,
	ContentStats,
	RepoString
} from '$lib/types/db'
import { logAlways, logErrorAlways } from '$lib/log'

export class ContentDbService {
	static extractFilename(path: string): string {
		return path.split('/').pop() || path
	}

	static getRepoString(owner: string, repo_name: string): RepoString {
		return `${owner}/${repo_name}` as RepoString
	}

	static splitRepoString(repo: RepoString): { owner: string; repo_name: string } {
		const [owner, repo_name] = repo.split('/')
		return { owner, repo_name }
	}

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

	static async getContentByFilter(filter: ContentFilter): Promise<DbContent[]> {
		try {
			const conditions: string[] = []
			const params: unknown[] = []
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
	 * Search content by title (from metadata) or path pattern
	 * This performs the search at the database level for efficiency
	 */
	static async searchContent(
		owner: string,
		repo_name: string,
		searchQuery: string,
		pathPattern?: string
	): Promise<DbContent | null> {
		try {
			const lowerQuery = searchQuery.toLowerCase()

			// First, try exact title match using JSON operators
			let queryStr = `
				SELECT * FROM content 
				WHERE owner = $1 
					AND repo_name = $2 
					AND path LIKE $3
					AND LOWER(metadata->>'title') = $4
				LIMIT 1
			`

			let params = [owner, repo_name, pathPattern ? pathPattern.replace('*', '%') : '%', lowerQuery]

			let result = await query(queryStr, params)

			if (result.rows.length > 0) {
				return result.rows[0] as DbContent
			}

			// Then try partial title match
			queryStr = `
				SELECT * FROM content 
				WHERE owner = $1 
					AND repo_name = $2 
					AND path LIKE $3
					AND LOWER(metadata->>'title') LIKE $4
				LIMIT 1
			`

			params = [
				owner,
				repo_name,
				pathPattern ? pathPattern.replace('*', '%') : '%',
				`%${lowerQuery}%`
			]

			result = await query(queryStr, params)

			if (result.rows.length > 0) {
				return result.rows[0] as DbContent
			}

			// Finally try path match for backward compatibility
			queryStr = `
				SELECT * FROM content 
				WHERE owner = $1 
					AND repo_name = $2 
					AND path LIKE $3
					AND LOWER(path) LIKE $4
				LIMIT 1
			`

			params = [
				owner,
				repo_name,
				pathPattern ? pathPattern.replace('*', '%') : '%',
				`%${lowerQuery}%`
			]

			result = await query(queryStr, params)

			return result.rows.length > 0 ? (result.rows[0] as DbContent) : null
		} catch (error) {
			logErrorAlways(`Failed to search content for "${searchQuery}":`, error)
			throw new Error(
				`Failed to search content: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get documentation sections list with minimal data for efficiency
	 * Only fetches path, content length, and metadata for sections
	 */
	static async getDocumentationSections(
		owner: string,
		repo_name: string,
		pathPattern: string,
		minContentLength: number = 100
	): Promise<Array<{ path: string; metadata: Record<string, unknown>; content: string }>> {
		try {
			const queryStr = `
				SELECT path, metadata, content
				FROM content 
				WHERE owner = $1 
					AND repo_name = $2 
					AND path LIKE $3
					AND LENGTH(content) >= $4
				ORDER BY path
			`

			const params = [owner, repo_name, pathPattern.replace('*', '%'), minContentLength]

			const result = await query(queryStr, params)

			return result.rows.map((row) => ({
				path: row.path,
				metadata: row.metadata,
				content: row.content
			}))
		} catch (error) {
			logErrorAlways('Failed to get documentation sections:', error)
			throw new Error(
				`Failed to get sections: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	static async markContentAsProcessed(
		owner: string,
		repo_name: string,
		path: string,
		metadata?: Record<string, unknown>
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

	static async getContentStats(): Promise<ContentStats> {
		try {
			const totalResult = await query(
				`SELECT 
					COUNT(*) as total_files,
					COALESCE(SUM(size_bytes), 0) as total_size_bytes,
					MAX(updated_at) as last_updated
				FROM content`
			)

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

	static async hasContentChanged(
		owner: string,
		repo_name: string,
		path: string,
		newContent: string
	): Promise<boolean> {
		try {
			const existing = await ContentDbService.getContentByPath(owner, repo_name, path)
			if (!existing) return true

			return existing.content !== newContent
		} catch (error) {
			logErrorAlways(`Failed to check content change for ${owner}/${repo_name}/${path}:`, error)
			return true // Assume changed on error
		}
	}

	static async batchUpsertContent(contents: CreateContentInput[]): Promise<DbContent[]> {
		try {
			const results: DbContent[] = []

			// Process in chunks to avoid overwhelming the database
			const chunkSize = 100
			for (let i = 0; i < contents.length; i += chunkSize) {
				const chunk = contents.slice(i, i + chunkSize)

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

	static extractFrontmatter(content: string): Record<string, unknown> {
		const metadata: Record<string, unknown> = {}

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
					metadata[key] = cleanValue
				}
			}
		}

		return metadata
	}
}
