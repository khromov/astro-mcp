import type { PresetConfig } from '$lib/presets'
import { presets, getDefaultRepository } from '$lib/presets'

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
 * Get all unique repositories from presets
 * Since we now use a single repository, this will return only sveltejs/svelte.dev
 */
export function getUniqueRepositories(): Repository[] {
	const { owner, repo } = getDefaultRepository()
	return [
		{
			owner,
			repo,
			key: `${owner}/${repo}`
		}
	]
}

/**
 * Group presets by their repository
 * Since we now use a single repository, all presets will be in one group
 */
export function groupPresetsByRepository(): PresetsByRepository[] {
	const { owner, repo } = getDefaultRepository()
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
 * Since we now use a single repository, this returns all presets if it matches
 */
export function getPresetsForRepository(
	owner: string,
	repo: string
): Array<{ key: string; config: PresetConfig }> {
	const defaultRepo = getDefaultRepository()

	// Check if the requested repository matches our default
	if (owner === defaultRepo.owner && repo === defaultRepo.repo) {
		return Object.entries(presets).map(([key, config]) => ({ key, config }))
	}

	return []
}

/**
 * Check if multiple presets share the same repository
 * Since we now use a single repository, this always returns true
 */
export function doPresetsShareRepository(presetKeys: string[]): boolean {
	return presetKeys.length >= 2
}

/**
 * Get repository statistics
 * Since we now use a single repository, stats are simplified
 */
export function getRepositoryStats(): {
	totalRepositories: number
	totalPresets: number
	presetsPerRepository: Record<string, number>
} {
	const { owner, repo } = getDefaultRepository()
	const repoKey = `${owner}/${repo}`

	return {
		totalRepositories: 1,
		totalPresets: Object.keys(presets).length,
		presetsPerRepository: {
			[repoKey]: Object.keys(presets).length
		}
	}
}
