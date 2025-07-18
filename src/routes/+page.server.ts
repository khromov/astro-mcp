import type { PageServerLoad } from './$types'
import { presets } from '$lib/presets'
import { getPresetSizeKb } from '$lib/presetCache'
import { PresetDbService } from '$lib/server/presetDb'
import { DistillablePreset } from '$lib/types/db'
import { logAlways, logErrorAlways } from '$lib/log'

// Virtual distilled presets that aren't in the presets object
const VIRTUAL_DISTILLED_PRESETS = [
	DistillablePreset.SVELTE_DISTILLED,
	DistillablePreset.SVELTEKIT_DISTILLED,
	DistillablePreset.SVELTE_COMPLETE_DISTILLED
]

// Get all preset keys from both regular presets and virtual ones
const ALL_PRESET_KEYS = [...Object.keys(presets), ...VIRTUAL_DISTILLED_PRESETS]

/**
 * Fetch size for a single preset
 */
async function fetchPresetSize(
	presetKey: string
): Promise<{ key: string; sizeKb: number | null; error?: string }> {
	try {
		const isVirtualPreset = VIRTUAL_DISTILLED_PRESETS.includes(presetKey as DistillablePreset)
		const isRegularPreset = presetKey in presets
		const isDistilledPreset = isVirtualPreset || presets[presetKey]?.distilled

		if (!isVirtualPreset && !isRegularPreset) {
			return { key: presetKey, sizeKb: null, error: 'Invalid preset' }
		}

		let sizeKb: number | null = null

		if (isDistilledPreset) {
			// Get size from distillations table
			const distillation = await PresetDbService.getLatestDistillation(presetKey)
			if (distillation) {
				sizeKb = distillation.size_kb
			}
		} else {
			// Calculate size on-demand from content table
			sizeKb = await getPresetSizeKb(presetKey)
		}

		return { key: presetKey, sizeKb: sizeKb || 0 }
	} catch (error) {
		logErrorAlways(`Error fetching size for preset ${presetKey}:`, error)
		return {
			key: presetKey,
			sizeKb: null,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}

export const load: PageServerLoad = async () => {
	logAlways(`Starting parallel fetch of sizes for ${ALL_PRESET_KEYS.length} presets`)

	// Create streaming promises for all preset sizes
	// These will resolve independently as each preset size is calculated
	const presetSizePromises = ALL_PRESET_KEYS.reduce(
		(acc, presetKey) => {
			acc[presetKey] = fetchPresetSize(presetKey)
			return acc
		},
		{} as Record<string, Promise<{ key: string; sizeKb: number | null; error?: string }>>
	)

	logAlways('Returning streaming promises for preset sizes')

	// Return the promises directly - SvelteKit will stream them as they resolve
	return {
		presetSizes: presetSizePromises
	}
}
