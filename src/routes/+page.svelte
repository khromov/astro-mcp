<script lang="ts">
	import { onMount } from 'svelte'
	import {
		combinedPresets,
		sveltePresets,
		svelteKitPresets,
		otherPresets,
		transformAndSortPresets
	} from '$lib/presets'
	import { SITE_URL } from '$lib/constants'
	import { DistillablePreset } from '$lib/types/db'
	import { logErrorAlways } from '$lib/log'

	import HeroSection from '$lib/components/home/HeroSection.svelte'
	import McpSection from '$lib/components/home/McpSection.svelte'
	import UsageSection from '$lib/components/home/UsageSection.svelte'
	import PresetSection from '$lib/components/home/PresetSection.svelte'
	import IntegrationSection from '$lib/components/home/IntegrationSection.svelte'
	import SiteFooter from '$lib/components/home/SiteFooter.svelte'

	const SSE_ENDPOINT = 'https://svelte-llm.khromov.se/mcp/sse'
	const STREAMABLE_ENDPOINT = 'https://svelte-llm.khromov.se/mcp/mcp'

	const combinedPresetsFormatted = transformAndSortPresets(combinedPresets)
	const sveltePresetsFormatted = transformAndSortPresets(sveltePresets)
	const svelteKitPresetsFormatted = transformAndSortPresets(svelteKitPresets)
	const otherPresetsFormatted = transformAndSortPresets(otherPresets)

	const svelteDistilledPreset = {
		key: DistillablePreset.SVELTE_DISTILLED,
		title: '🔮 Svelte (LLM Distilled)',
		description: 'AI-condensed version of just the Svelte 5 docs'
	}

	const svelteKitDistilledPreset = {
		key: DistillablePreset.SVELTEKIT_DISTILLED,
		title: '🔮 SvelteKit (LLM Distilled)',
		description: 'AI-condensed version of just the SvelteKit docs'
	}

	type DistilledVersion = {
		filename: string
		date: string
		path: string
		sizeKb: number
	}

	let distilledVersions = $state<Record<string, DistilledVersion[]>>({
		[DistillablePreset.SVELTE_COMPLETE_DISTILLED]: [],
		[DistillablePreset.SVELTE_DISTILLED]: [],
		[DistillablePreset.SVELTEKIT_DISTILLED]: []
	})
	let loadingVersions = $state(true)
	let distilledError = $state<string | null>(null)

	const loadVersions = async (preset: string): Promise<DistilledVersion[]> => {
		try {
			const response = await fetch(`/api/distilled-versions?preset=${preset}`)
			if (response.ok) {
				return await response.json()
			} else {
				logErrorAlways(
					`Failed to load distilled versions for ${preset}: ${response.status} ${response.statusText}`
				)
				return []
			}
		} catch (e) {
			logErrorAlways(`Failed to load distilled versions for ${preset}:`, e)
			return [] // Return empty array instead of throwing
		}
	}

	onMount(async () => {
		try {
			loadingVersions = true

			// Load all versions in parallel - now all promises will resolve (never reject)
			const presetKeys = Object.keys(distilledVersions)
			const versionPromises = presetKeys.map((key) => loadVersions(key))
			const allVersions = await Promise.all(versionPromises)

			// Store results
			presetKeys.forEach((key, index) => {
				distilledVersions[key] = allVersions[index]
			})
		} catch (e) {
			// This should not happen anymore since loadVersions doesn't throw
			distilledError = `Error loading versions: ${e instanceof Error ? e.message : String(e)}`
		} finally {
			loadingVersions = false
		}
	})
</script>

<main>
	<HeroSection />

	<McpSection sseEndpoint={SSE_ENDPOINT} streamableEndpoint={STREAMABLE_ENDPOINT} />

	<UsageSection siteUrl={SITE_URL} />

	<PresetSection
		title="Combined presets"
		description="Hand-picked combinations of the Svelte 5 + SvelteKit docs in a variety of sizes to fit different LLMs."
		presets={combinedPresetsFormatted}
		{distilledVersions}
		{loadingVersions}
		{distilledError}
	/>

	<PresetSection
		title="Svelte 5"
		presets={sveltePresetsFormatted}
		extraPresets={[svelteDistilledPreset]}
		{distilledVersions}
		{loadingVersions}
		{distilledError}
	/>

	<PresetSection
		title="SvelteKit"
		presets={svelteKitPresetsFormatted}
		extraPresets={[svelteKitDistilledPreset]}
		{distilledVersions}
		{loadingVersions}
		{distilledError}
	/>

	<PresetSection title="Other" presets={otherPresetsFormatted} />

	<section class="presets-section">
		<div class="section-header">
			<h2>Legacy</h2>
		</div>
		<div class="preset-list">
			<div class="preset-item">
				<a target="_blank" href="https://v4.svelte.dev/content.json">Svelte 4 Legacy + SvelteKit</a>
			</div>
		</div>
	</section>

	<IntegrationSection siteUrl={SITE_URL} />

	<SiteFooter />
</main>

<style>
	:global(html) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		line-height: 1.6;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24px;
		background: #fbfbfd;
		min-height: 100vh;
	}

	/* Legacy section specific styles */
	.presets-section {
		margin-bottom: 25px;
	}

	.section-header {
		margin-bottom: 16px;
		padding-top: 12px;
	}

	.section-header h2 {
		font-size: 24px;
		font-weight: 700;
		margin: 0 0 8px 0;
		color: #1d1d1f;
		letter-spacing: -0.01em;
		position: relative;
		padding-bottom: 6px;
	}

	.section-header h2::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		width: 60px;
		height: 3px;
		background: linear-gradient(90deg, #ff3e00 0%, #ff6b35 100%);
		border-radius: 2px;
	}

	.preset-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.preset-item {
		background: white;
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(0, 0, 0, 0.06);
		transition: all 0.2s ease;
	}

	.preset-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
	}

	.preset-item a {
		color: #007aff;
		text-decoration: none;
		font-weight: 500;
	}

	.preset-item a:hover {
		color: #0056b3;
	}

	@media (max-width: 768px) {
		main {
			padding: 0 16px;
		}

		.section-header h2 {
			font-size: 24px;
		}
	}
</style>
