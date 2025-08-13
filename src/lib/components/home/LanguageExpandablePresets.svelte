<script lang="ts">
	import PresetListItem from '$lib/components/PresetListItem.svelte'

	interface PresetData {
		key: string
		title: string
		description?: string
		distilled?: boolean
		distilledFilenameBase?: string
		languageCode?: string
		isLanguageVariant?: boolean
	}

	interface Props {
		basePreset: PresetData
		languagePresets: PresetData[]
		presetSizes?: Record<string, Promise<{ key: string; sizeKb: number | null; error?: string }>>
		distilledVersionsPromises?: Record<
			string,
			Promise<{
				key: string
				versions: Array<{ filename: string; date: string; path: string; sizeKb: number }>
				error?: string
			}>
		>
	}

	let { basePreset, languagePresets, presetSizes, distilledVersionsPromises }: Props = $props()

	let isExpanded = $state(false)

	// Separate English from other languages
	const englishPreset = $derived(languagePresets.find((p) => p.languageCode === 'en'))
	const otherLanguagePresets = $derived(languagePresets.filter((p) => p.languageCode !== 'en'))

	function toggleExpanded() {
		isExpanded = !isExpanded
	}
</script>

<div class="language-preset-group">
	<!-- Base preset (All Languages) -->
	<PresetListItem
		{...basePreset}
		presetSizePromise={presetSizes?.[basePreset.key]}
		distilledVersionsPromise={distilledVersionsPromises?.[basePreset.key]}
	/>

	<!-- English preset (always visible) -->
	{#if englishPreset}
		<div class="language-variant english-variant">
			<PresetListItem
				{...englishPreset}
				presetSizePromise={presetSizes?.[englishPreset.key]}
				distilledVersionsPromise={distilledVersionsPromises?.[englishPreset.key]}
			/>
		</div>
	{/if}

	<!-- Other language presets (expandable) -->
	{#if otherLanguagePresets.length > 0}
		<div class="expand-section">
			<button class="expand-button" onclick={toggleExpanded}>
				<span class="expand-icon">{isExpanded ? '▼' : '▶'}</span>
				{isExpanded ? 'Hide' : 'Show'} other languages ({otherLanguagePresets.length})
			</button>

			{#if isExpanded}
				<div class="language-variants">
					{#each otherLanguagePresets as preset}
						<div class="language-variant">
							<PresetListItem
								{...preset}
								presetSizePromise={presetSizes?.[preset.key]}
								distilledVersionsPromise={distilledVersionsPromises?.[preset.key]}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.language-preset-group {
		margin-bottom: 24px;
	}

	.language-variant {
		margin-left: 20px;
		margin-top: 12px;
		padding-left: 16px;
		border-left: 3px solid #e5e7eb;
	}

	.english-variant {
		border-left-color: #10b981;
	}

	.expand-section {
		margin-top: 12px;
		margin-left: 20px;
	}

	.expand-button {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #f5f5f7;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 8px;
		padding: 10px 16px;
		font-size: 14px;
		font-weight: 500;
		color: #1d1d1f;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.expand-button:hover {
		background: #e5e7eb;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.expand-icon {
		font-size: 12px;
		color: #6e6e73;
	}

	.language-variants {
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.language-variant {
			margin-left: 12px;
			padding-left: 12px;
		}

		.expand-section {
			margin-left: 12px;
		}
	}
</style>
