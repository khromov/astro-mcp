<script lang="ts">
	import type { PageData } from './$types'
	import { astroPresets, transformAndSortPresets } from '$lib/presets'
	import { SITE_URL } from '$lib/constants'
	import { DistillablePreset } from '$lib/types/db'

	import HeroSection from '$lib/components/home/HeroSection.svelte'
	import McpSection from '$lib/components/home/McpSection.svelte'
	import UsageSection from '$lib/components/home/UsageSection.svelte'
	import PresetSection from '$lib/components/home/PresetSection.svelte'
	import IntegrationSection from '$lib/components/home/IntegrationSection.svelte'
	import SiteFooter from '$lib/components/home/SiteFooter.svelte'

	// Get the streamed data from the load function
	let { data }: { data: PageData } = $props()

	const SSE_ENDPOINT = 'https://astro-llm.stanislav.garden/mcp/sse'
	const STREAMABLE_ENDPOINT = 'https://astro-llm.stanislav.garden/mcp/mcp'

	const astroPresetsFormatted = transformAndSortPresets(astroPresets)
</script>

<main>
	<HeroSection isOldHost={data.isOldHost} />

	<McpSection sseEndpoint={SSE_ENDPOINT} streamableEndpoint={STREAMABLE_ENDPOINT} />

	<UsageSection siteUrl={SITE_URL} />

	<PresetSection
		title="Astro Documentation"
		description="Complete Astro documentation in various formats for different AI assistants and use cases."
		presets={astroPresetsFormatted}
		presetSizes={data.presetSizes}
		distilledVersionsPromises={data.distilledVersions}
	/>

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

	@media (max-width: 768px) {
		main {
			padding: 0 16px;
		}
	}
</style>
