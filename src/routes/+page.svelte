<script context="module" lang="ts">
	import PresetListItem from '$lib/components/PresetListItem.svelte'
</script>

<script lang="ts">
	import type { PageData } from './$types'
	import { SITE_URL } from '$lib/constants'
	import type { PresetConfig } from '$lib/presets'

	import HeroSection from '$lib/components/home/HeroSection.svelte'
	import McpSection from '$lib/components/home/McpSection.svelte'
	import UsageSection from '$lib/components/home/UsageSection.svelte'
	import IntegrationSection from '$lib/components/home/IntegrationSection.svelte'
	import SiteFooter from '$lib/components/home/SiteFooter.svelte'

	// Get the streamed data from the load function
	let { data }: { data: PageData } = $props()

	const SSE_ENDPOINT = 'https://astro-mcp.stanislav.garden/mcp/sse'
	const STREAMABLE_ENDPOINT = 'https://astro-mcp.stanislav.garden/mcp/mcp'

	// Use presets from server data
	const presets = data.presets as Record<string, PresetConfig>

	// Separate base presets from language variants
	const basePresets = $derived(
		Object.entries(presets)
			.filter(([, preset]) => !preset.isLanguageVariant)
			.map(([key, preset]) => ({ key, ...preset }))
	)

	const languagePresets = $derived(
		Object.entries(presets)
			.filter(([, preset]) => preset.isLanguageVariant)
			.map(([key, preset]) => ({ key, ...preset }))
	)

	// Find the distilled preset and language variants
	const astroDistilledPreset = $derived(basePresets.find((p) => p.key === 'astro-distilled'))
</script>

<main>
	<HeroSection />

	<McpSection sseEndpoint={SSE_ENDPOINT} streamableEndpoint={STREAMABLE_ENDPOINT} />

	<UsageSection siteUrl={SITE_URL} />

	<section class="presets-section">
		<div class="section-header">
			<h2>Astro Documentation</h2>
			<p class="section-description">
				Complete Astro documentation in various formats and languages for different AI assistants
				and use cases.
			</p>
		</div>

		<div class="preset-list">
			{#if astroDistilledPreset}
				<PresetListItem
					{...astroDistilledPreset}
					presetSizePromise={data.presetSizes[astroDistilledPreset.key]}
					distilledVersionsPromise={data.distilledVersions[astroDistilledPreset.key]}
				/>
			{/if}

			{#each languagePresets as preset}
				<PresetListItem
					{...preset}
					presetSizePromise={data.presetSizes[preset.key]}
					distilledVersionsPromise={data.distilledVersions[preset.key]}
				/>
			{/each}
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
		background: linear-gradient(90deg, #000000 0%, #4a4a4a 100%);
		border-radius: 2px;
	}

	.section-description {
		font-size: 16px;
		color: #6e6e73;
		margin: 0;
		line-height: 1.5;
		max-width: 600px;
	}

	.preset-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	@media (max-width: 768px) {
		main {
			padding: 0 16px;
		}

		.section-header h2 {
			font-size: 24px;
		}

		.section-description {
			font-size: 16px;
		}
	}
</style>
