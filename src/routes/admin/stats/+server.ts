import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { PresetDbService } from '$lib/server/presetDb'
import { query } from '$lib/server/db'

export const GET: RequestHandler = async ({ url }) => {
	// Check for admin secret key
	const secretKey = url.searchParams.get('secret_key')
	const adminKey = env.ADMIN_SECRET_KEY || env.DISTILL_SECRET_KEY

	if (!adminKey) {
		throw error(500, 'Server is not configured for admin access')
	}

	if (secretKey !== adminKey) {
		throw error(403, 'Invalid secret key')
	}

	try {
		// Get all preset summaries
		const presetSummaries = await PresetDbService.getAllPresetSummaries()

		// Get recent distillation jobs
		const distillationJobs = await query(
			`SELECT * FROM distillation_job_summary 
			ORDER BY created_at DESC 
			LIMIT 10`
		)

		// Get overall statistics
		const stats = await query(
			`SELECT 
				(SELECT COUNT(*) FROM presets) as total_presets,
				(SELECT COUNT(*) FROM documents) as total_documents,
				(SELECT COUNT(*) FROM preset_versions) as total_versions,
				(SELECT COUNT(*) FROM distillation_jobs) as total_distillation_jobs,
				(SELECT COUNT(*) FROM distillation_jobs WHERE status = 'completed') as completed_distillations,
				(SELECT SUM(cache_hits) FROM cache_stats) as total_cache_hits,
				(SELECT SUM(cache_misses) FROM cache_stats) as total_cache_misses,
				(SELECT SUM(file_size_bytes) FROM documents) as total_bytes_stored`
		)

		// Get preset-specific statistics
		const presetStats = await query(
			`SELECT 
				p.key,
				p.title,
				p.is_distilled,
				COUNT(DISTINCT d.id) as document_count,
				COUNT(DISTINCT pv.id) as version_count,
				MAX(pv.generated_at) as last_generated,
				SUM(d.file_size_bytes) as total_bytes,
				cs.cache_hits,
				cs.cache_misses,
				cs.last_accessed_at
			FROM presets p
			LEFT JOIN documents d ON p.id = d.preset_id
			LEFT JOIN preset_versions pv ON p.id = pv.preset_id
			LEFT JOIN cache_stats cs ON p.id = cs.preset_id
			GROUP BY p.id, p.key, p.title, p.is_distilled, cs.cache_hits, cs.cache_misses, cs.last_accessed_at
			ORDER BY p.key`
		)

		return json({
			success: true,
			summary: {
				total_presets: parseInt(stats?.rows[0]?.total_presets || '0'),
				total_documents: parseInt(stats?.rows[0]?.total_documents || '0'),
				total_versions: parseInt(stats?.rows[0]?.total_versions || '0'),
				total_distillation_jobs: parseInt(stats?.rows[0]?.total_distillation_jobs || '0'),
				completed_distillations: parseInt(stats?.rows[0]?.completed_distillations || '0'),
				total_cache_hits: parseInt(stats?.rows[0]?.total_cache_hits || '0'),
				total_cache_misses: parseInt(stats?.rows[0]?.total_cache_misses || '0'),
				total_bytes_stored: parseInt(stats?.rows[0]?.total_bytes_stored || '0'),
				total_mb_stored: Math.round(
					parseInt(stats?.rows[0]?.total_bytes_stored || '0') / 1024 / 1024
				)
			},
			presets: presetSummaries,
			preset_details: presetStats?.rows || [],
			recent_distillation_jobs: distillationJobs?.rows || []
		})
	} catch (e) {
		console.error('Error fetching admin stats:', e)
		throw error(500, `Failed to fetch admin stats: ${e instanceof Error ? e.message : String(e)}`)
	}
}
