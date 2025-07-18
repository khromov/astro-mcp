import type { PresetConfig } from '$lib/presets'
import { presets, DEFAULT_REPOSITORY } from '$lib/presets'

export interface Repository {
	owner: string
	repo: string
	key: string
}

export interface PresetsByRepository {
	repository: Repository
	presets: Array<{
		key: string
		config: PresetConfig
	}>
}

/**
 * Get the default repository (now the only repository used)
 */
export function getUniqueRepositories(): Repository[] {
	const { owner, repo } = DEFAULT_REPOSITORY
	return [
		{
			owner,
			repo,
			key: `${owner}/${repo}`
		}
	]
}

/**
 * Group presets by repository (all presets use the same repository now)
 */
export function groupPresetsByRepository(): PresetsByRepository[] {
	const { owner, repo } = DEFAULT_REPOSITORY
	const repository = {
		owner,
		repo,
		key: `${owner}/${repo}`
	}

	return [
		{
			repository,
			presets: Object.entries(presets).map(([key, config]) => ({ key, config }))
		}
	]
}

/**
 * Get all presets for a specific repository
 */
export function getPresetsForRepository(
	owner: string,
	repo: string
): Array<{ key: string; config: PresetConfig }> {
	const defaultRepo = DEFAULT_REPOSITORY

	// Check if the requested repository matches our default
	if (owner === defaultRepo.owner && repo === defaultRepo.repo) {
		return Object.entries(presets).map(([key, config]) => ({ key, config }))
	}

	return []
}

/**
 * Check if multiple presets share the same repository (always true now)
 */
export function doPresetsShareRepository(presetKeys: string[]): boolean {
	return presetKeys.length >= 2
}

/**
 * Get repository statistics (simplified for single repository)
 */
export function getRepositoryStats(): {
	totalRepositories: number
	totalPresets: number
	presetsPerRepository: Record<string, number>
} {
	const { owner, repo } = DEFAULT_REPOSITORY
	const repoKey = `${owner}/${repo}`

	return {
		totalRepositories: 1,
		totalPresets: Object.keys(presets).length,
		presetsPerRepository: {
			[repoKey]: Object.keys(presets).length
		}
	}
}
