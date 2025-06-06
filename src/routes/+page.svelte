<script lang="ts">
	import { onMount } from 'svelte'
	import {
		combinedPresets,
		sveltePresets,
		svelteKitPresets,
		otherPresets,
		transformAndSortPresets
	} from '$lib/presets'
	import PresetListItem from '$lib/components/PresetListItem.svelte'
	import { SITE_URL } from '$lib/constants'
	import toast from 'svelte-french-toast'

	const combinedPresetsFormatted = transformAndSortPresets(combinedPresets)
	const sveltePresetsFormatted = transformAndSortPresets(sveltePresets)
	const svelteKitPresetsFormatted = transformAndSortPresets(svelteKitPresets)
	const otherPresetsFormatted = transformAndSortPresets(otherPresets)

	// Define virtual distilled presets
	const svelteDistilledPreset = {
		key: 'svelte-distilled',
		title: '🔮 Svelte (LLM Distilled)',
		description: 'AI-condensed version of just the Svelte 5 docs'
	}

	const svelteKitDistilledPreset = {
		key: 'sveltekit-distilled',
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
		'svelte-complete-distilled': [],
		'svelte-distilled': [],
		'sveltekit-distilled': []
	})
	let loadingVersions = $state(true)
	let distilledError = $state<string | null>(null)

	const loadVersions = async (preset: string) => {
		try {
			const response = await fetch(`/api/distilled-versions?preset=${preset}`)
			if (response.ok) {
				return await response.json()
			} else {
				throw new Error(`Failed to load versions: ${response.status} ${response.statusText}`)
			}
		} catch (e) {
			console.error(`Failed to load distilled versions for ${preset}:`, e)
			throw e
		}
	}

	onMount(async () => {
		try {
			loadingVersions = true

			// Load all versions in parallel
			const presetKeys = Object.keys(distilledVersions)
			const versionPromises = presetKeys.map((key) => loadVersions(key))
			const allVersions = await Promise.all(versionPromises)

			// Store results
			presetKeys.forEach((key, index) => {
				distilledVersions[key] = allVersions[index]
			})
		} catch (e) {
			distilledError = `Error loading versions: ${e instanceof Error ? e.message : String(e)}`
		} finally {
			loadingVersions = false
		}
	})

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text)
			toast.success('Copied to clipboard!')
		} catch (err) {
			toast.error('Failed to copy to clipboard')
		}
	}

	const instructions = [
		{
			title: 'Cursor',
			description: `Cursor supports adding context via URL using the <a href="https://docs.cursor.com/context/@-symbols/@-link#paste-links">Paste Links</a> feature.`,
			command: `@${SITE_URL}/[preset]`
		},
		{
			title: 'Zed',
			description:
				'You can use this project directly in Zed using a <a href="https://zed.dev/docs/assistant/commands">/fetch command</a>.',
			command: `/fetch ${SITE_URL}/[preset]`
		},
		{
			title: 'cURL',
			description: `Let's be real—if you clicked this, you probably already know how to use cURL. But if you don't, here's a quick example:`,
			command: `curl ${SITE_URL}/[preset] -o context.txt`
		}
	]
</script>

<main>
	<header class="hero">
		<div class="hero-content">
			<div class="logo">svelte-llm</div>
			<h1>Developer documentation for Svelte in an LLM-ready format</h1>
			<p class="hero-description">
				This site provides Svelte 5 and SvelteKit documentation in an LLM-friendly format, also
				known as <em>llms.txt</em>. Pick a preset and get an AI-ready context text file. Perfect for
				coding with AI assistants like Cursor or Zed, or uploading to Claude Projects.
			</p>
			<p class="hero-note">
				Documentation is automatically fetched from the <a
					target="_blank"
					href="https://github.com/sveltejs/svelte.dev/tree/main/apps/svelte.dev/content"
					>official documentation</a
				> source on GitHub and updated hourly.
			</p>
		</div>
	</header>

	<section class="usage-section">
		<div class="usage-grid">
			<div class="usage-card">
				<h3>Single preset</h3>
				<div class="code-block">
					<code>{SITE_URL}/</code><code class="highlight">[preset]</code>
				</div>
				<a href="/svelte-complete-medium" class="example-link">View example →</a>
			</div>

			<div class="usage-card">
				<h3>Multiple presets</h3>
				<div class="code-block">
					<code>{SITE_URL}/</code><code class="highlight">svelte,sveltekit,svelte-cli</code>
				</div>
				<a href="/svelte,sveltekit,svelte-cli" class="example-link">View example →</a>
			</div>
		</div>

		<div class="mcp-section">
			<div class="mcp-header">
				<span class="new-badge">New</span>
				<h3>MCP Server Integration</h3>
			</div>
			<details class="mcp-details">
				<summary>MCP (Model Context Protocol) Endpoints</summary>
				<div class="mcp-content">
					<p>Connect this service to AI assistants that support MCP:</p>
					<div class="endpoint-list">
						<div class="endpoint-item">
							<div class="endpoint-header">
								<strong>SSE (Claude Desktop)</strong>
							</div>
							<div class="endpoint-url">
								<code>https://svelte-llm.khromov.se/mcp/sse</code>
								<button
									class="mcp-copy-btn"
									onclick={() => copyToClipboard('https://svelte-llm.khromov.se/mcp/sse')}
								>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path
											d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"
										/>
										<path
											d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"
										/>
									</svg>
									Copy
								</button>
							</div>
						</div>
						<div class="endpoint-item">
							<div class="endpoint-header">
								<strong>Streamable HTTP (most other clients)</strong>
							</div>
							<div class="endpoint-url">
								<code>https://svelte-llm.khromov.se/mcp/mcp</code>
								<button
									class="mcp-copy-btn"
									onclick={() => copyToClipboard('https://svelte-llm.khromov.se/mcp/mcp')}
								>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path
											d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"
										/>
										<path
											d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"
										/>
									</svg>
									Copy
								</button>
							</div>
						</div>
					</div>
				</div>
			</details>
		</div>

		<div class="presets-section">
			<div class="section-header">
				<h2>Combined presets</h2>
				<p class="section-description">
					Hand-picked combinations of the Svelte 5 + SvelteKit docs in a variety of sizes to fit
					different LLMs.
				</p>
			</div>
			<div class="preset-list">
				{#each combinedPresetsFormatted as preset}
					<PresetListItem
						{...preset}
						distilledVersions={preset.key === 'svelte-complete-distilled'
							? distilledVersions['svelte-complete-distilled']
							: undefined}
						{loadingVersions}
						{distilledError}
					/>
				{/each}
			</div>
		</div>

		<div class="presets-section">
			<div class="section-header">
				<h2>Svelte 5</h2>
			</div>
			<div class="preset-list">
				<!-- Add the Svelte-only distilled preset at the top of the Svelte section -->
				<PresetListItem
					{...svelteDistilledPreset}
					distilledVersions={distilledVersions['svelte-distilled']}
					{loadingVersions}
					{distilledError}
				/>

				{#each sveltePresetsFormatted as preset}
					<PresetListItem {...preset} />
				{/each}
			</div>
		</div>

		<div class="presets-section">
			<div class="section-header">
				<h2>SvelteKit</h2>
			</div>
			<div class="preset-list">
				<!-- Add the SvelteKit-only distilled preset at the top of the SvelteKit section -->
				<PresetListItem
					{...svelteKitDistilledPreset}
					distilledVersions={distilledVersions['sveltekit-distilled']}
					{loadingVersions}
					{distilledError}
				/>

				{#each svelteKitPresetsFormatted as preset}
					<PresetListItem {...preset} />
				{/each}
			</div>
		</div>

		<div class="presets-section">
			<div class="section-header">
				<h2>Other</h2>
			</div>
			<div class="preset-list">
				{#each otherPresetsFormatted as preset}
					<PresetListItem {...preset} />
				{/each}
			</div>
		</div>

		<div class="presets-section">
			<div class="section-header">
				<h2>Legacy</h2>
			</div>
			<div class="preset-list">
				<div class="preset-item">
					<a target="_blank" href="https://v4.svelte.dev/content.json"
						>Svelte 4 Legacy + SvelteKit</a
					>
				</div>
			</div>
		</div>
	</section>

	<section class="integration-section">
		<div class="section-header">
			<h2>AI Assistant Integration</h2>
			<p class="section-description">
				Multiple ways to use these presets with your favorite AI coding assistants
			</p>
		</div>

		<div class="integration-grid">
			{#each instructions as { title, description, command }}
				<div class="integration-card">
					<h3>{title}</h3>
					<p>{@html description}</p>
					<div class="code-block">
						<code>{command}</code>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<footer class="site-footer">
		<p>
			Maintained by <a href="https://khromov.se" target="_blank">Stanislav Khromov</a> • Forked from
			<a target="_blank" href="https://twitter.com/didiercatz">Didier Catz</a>
		</p>
	</footer>
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

	/* Hero Section */
	.hero {
		text-align: center;
		padding: 60px 0 40px 0;
		background: linear-gradient(135deg, #ff3e00 0%, #ff6b35 100%);
		color: white;
		margin: 0 0 30px 0;
		border-radius: 0 0 20px 20px;
	}

	.hero-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 0 24px;
	}

	.logo {
		font-size: 18px;
		font-weight: 600;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		opacity: 0.9;
		margin-bottom: 16px;
	}

	.hero h1 {
		font-size: clamp(32px, 5vw, 48px);
		font-weight: 700;
		line-height: 1.2;
		margin: 0 0 24px 0;
		letter-spacing: -0.02em;
	}

	.hero-description {
		font-size: 20px;
		line-height: 1.5;
		margin: 0 0 20px 0;
		opacity: 0.95;
		font-weight: 400;
	}

	.hero-note {
		font-size: 16px;
		opacity: 0.8;
		margin: 0;
		font-weight: 400;
	}

	.hero-note a {
		color: rgba(255, 255, 255, 0.9);
		text-decoration: underline;
		text-decoration-color: rgba(255, 255, 255, 0.5);
		transition: text-decoration-color 0.2s ease;
	}

	.hero-note a:hover {
		text-decoration-color: rgba(255, 255, 255, 1);
	}

	/* Usage Section */
	.usage-section {
		margin-bottom: 30px;
	}

	.usage-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 16px;
		margin-bottom: 16px;
	}

	.usage-card {
		background: white;
		border-radius: 12px;
		padding: 24px;
		box-shadow:
			0 4px 24px rgba(0, 0, 0, 0.04),
			0 2px 8px rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(0, 0, 0, 0.06);
		transition: all 0.3s ease;
	}

	.usage-card:hover {
		transform: translateY(-4px);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.08),
			0 4px 16px rgba(0, 0, 0, 0.08);
	}

	.usage-card h3 {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 12px 0;
		color: #1d1d1f;
	}

	.code-block {
		background: #f5f5f7;
		border-radius: 8px;
		padding: 12px;
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		font-size: 13px;
		margin: 12px 0;
		border: 1px solid rgba(0, 0, 0, 0.08);
		word-break: break-all;
	}

	.code-block code {
		color: #1d1d1f;
	}

	.code-block .highlight {
		color: #007aff;
		font-weight: 600;
	}

	.example-link {
		color: #007aff;
		text-decoration: none;
		font-weight: 500;
		font-size: 14px;
		display: inline-flex;
		align-items: center;
		transition: color 0.2s ease;
	}

	.example-link:hover {
		color: #0056b3;
	}

	/* MCP Section */
	.mcp-section {
		background: white;
		border-radius: 12px;
		padding: 24px;
		box-shadow:
			0 4px 24px rgba(0, 0, 0, 0.04),
			0 2px 8px rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(0, 0, 0, 0.06);
		margin-bottom: 24px;
	}

	.mcp-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.new-badge {
		background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
		color: white;
		font-size: 12px;
		font-weight: 600;
		padding: 4px 8px;
		border-radius: 6px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.mcp-header h3 {
		font-size: 18px;
		font-weight: 600;
		margin: 0;
		color: #1d1d1f;
	}

	.mcp-details {
		margin-top: 16px;
	}

	.mcp-details summary {
		cursor: pointer;
		font-weight: 500;
		color: #007aff;
		padding: 8px 0;
		transition: color 0.2s ease;
	}

	.mcp-details summary:hover {
		color: #0056b3;
	}

	.mcp-content {
		padding-top: 16px;
	}

	.endpoint-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 16px;
	}

	.endpoint-item {
		background: #f5f5f7;
		border-radius: 8px;
		padding: 16px;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.endpoint-header {
		font-weight: 600;
		margin-bottom: 8px;
		color: #1d1d1f;
	}

	.endpoint-url {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.endpoint-url code {
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		font-size: 13px;
		color: #007aff;
		word-break: break-all;
		flex: 1;
		min-width: 200px;
	}

	.mcp-copy-btn {
		background: #f5f5f7;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 500;
		color: #1d1d1f;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	.mcp-copy-btn:hover {
		background: #007aff;
		color: white;
		border-color: #007aff;
		transform: translateY(-1px);
	}

	/* Presets Section */
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

	.integration-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 16px;
	}

	.integration-card {
		background: white;
		border-radius: 12px;
		padding: 24px;
		box-shadow:
			0 4px 24px rgba(0, 0, 0, 0.04),
			0 2px 8px rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(0, 0, 0, 0.06);
		transition: all 0.3s ease;
	}

	.integration-card:hover {
		transform: translateY(-4px);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.08),
			0 4px 16px rgba(0, 0, 0, 0.08);
	}

	.integration-card h3 {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 10px 0;
		color: #1d1d1f;
	}

	.integration-card p {
		font-size: 16px;
		color: #6e6e73;
		margin: 0 0 16px 0;
		line-height: 1.5;
	}

	.integration-card a {
		color: #007aff;
		text-decoration: none;
	}

	.integration-card a:hover {
		color: #0056b3;
		text-decoration: underline;
	}

	/* Footer */
	.site-footer {
		text-align: center;
		padding: 40px 0 60px 0;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		margin-top: 60px;
	}

	.site-footer p {
		font-size: 14px;
		color: #6e6e73;
		margin: 0;
	}

	.site-footer a {
		color: #007aff;
		text-decoration: none;
	}

	.site-footer a:hover {
		color: #0056b3;
		text-decoration: underline;
	}

	/* Remove rounded corners on smaller screens */
	@media (max-width: 768px) {
		.hero {
			border-radius: 0;
		}
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		main {
			padding: 0 16px;
		}

		.hero {
			margin: 0 -16px 40px -16px;
			padding: 60px 0 40px 0;
		}

		.hero-content {
			padding: 0 16px;
		}

		.hero h1 {
			font-size: 28px;
		}

		.hero-description {
			font-size: 18px;
		}

		.usage-grid,
		.integration-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}

		.usage-card,
		.integration-card,
		.mcp-section {
			padding: 24px;
		}

		.section-header h2 {
			font-size: 24px;
		}

		.section-description {
			font-size: 16px;
		}

		.endpoint-url {
			flex-direction: column;
			align-items: flex-start;
		}

		.endpoint-url code {
			min-width: unset;
			width: 100%;
		}
	}
</style>
