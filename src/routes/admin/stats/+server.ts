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
		// Get all presets
		const presets = await PresetDbService.getAllPresets()

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
				(SELECT COUNT(*) FROM distillation_jobs) as total_distillation_jobs,
				(SELECT COUNT(*) FROM distillation_jobs WHERE status = 'completed') as completed_distillations,
				(SELECT SUM(size_kb) FROM presets) as total_kb_stored`
		)

		// Get preset-specific statistics with distillation info
		const presetStats = await query(
			`SELECT 
				p.preset_name,
				p.size_kb,
				p.document_count,
				p.updated_at,
				(SELECT COUNT(*) FROM distillation_jobs WHERE preset_name = p.preset_name) as distillation_count,
				(SELECT MAX(created_at) FROM distillation_jobs WHERE preset_name = p.preset_name) as last_distillation
			FROM presets p
			ORDER BY p.preset_name`
		)

		return json({
			success: true,
			summary: {
				total_presets: parseInt(stats?.rows[0]?.total_presets || '0'),
				total_distillation_jobs: parseInt(stats?.rows[0]?.total_distillation_jobs || '0'),
				completed_distillations: parseInt(stats?.rows[0]?.completed_distillations || '0'),
				total_kb_stored: parseInt(stats?.rows[0]?.total_kb_stored || '0'),
				total_mb_stored: Math.round(parseInt(stats?.rows[0]?.total_kb_stored || '0') / 1024)
			},
			presets: presets,
			preset_details: presetStats?.rows || [],
			recent_distillation_jobs: distillationJobs?.rows || []
		})
	} catch (e) {
		console.error('Error fetching admin stats:', e)
		throw error(500, `Failed to fetch admin stats: ${e instanceof Error ? e.message : String(e)}`)
	}
}
