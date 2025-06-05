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
	<article>
		<div>svelte-llm</div>
		<h1>Developer documentation for Svelte in an LLM-ready format</h1>

		<p>
			This site provides Svelte 5 and SvelteKit documentation in an LLM-friendly format, also known
			as <em>llms.txt</em>. Pick a preset and get an AI-ready context text file. Perfect for coding
			with AI assistants like Cursor or Zed, or uploading to Claude Projects.
		</p>
		<p>
			Documentation is automatically fetched from the <a
				target="_blank"
				href="https://github.com/sveltejs/svelte.dev/tree/main/apps/svelte.dev/content"
				>official documentation</a
			> source on GitHub and updated hourly.
		</p>
	</article>

	<section>
		<h3>Single preset:</h3>
		<p>
			<code>{SITE_URL}/</code><code>[preset]</code> (<a href="/svelte-complete-medium">Link</a>)
		</p>
		<h3>Multiple presets:</h3>
		<p>
			<code>{SITE_URL}/</code><code>svelte,sveltekit,svelte-cli</code> (<a
				href="/svelte,sveltekit,svelte-cli">Link</a
			>)
		</p>

		<h3>👀 MCP server (New!)</h3>
		<details>
			<summary>MCP (Model Context Protocol) Endpoints</summary>
			<p>Use these endpoints to connect this service to AI assistants that support MCP:</p>
			<ul>
				<li>
					<strong>SSE (Claude Desktop):</strong> 
					<code>https://svelte-llm.khromov.se/mcp/sse</code>
					<a href="#mcp-sse" class="copy-link" on:click|preventDefault={() => navigator.clipboard.writeText('https://svelte-llm.khromov.se/mcp/sse')}>[📋 Copy]</a>
				</li>
				<li>
					<strong>Streamable HTTP (most other clients):</strong>
					<code>https://svelte-llm.khromov.se/mcp/mcp</code>
					<a href="#mcp-http" class="copy-link" on:click|preventDefault={() => navigator.clipboard.writeText('https://svelte-llm.khromov.se/mcp/mcp')}>[📋 Copy]</a>
				</li>
			</ul>
		</details>

		<h2>Combined presets</h2>
		<em>
			Hand-picked combinations of the Svelte 5 + SvelteKit docs in a variety of sizes to fit
			different LLMs.
		</em>
		<ul>
			{#each combinedPresetsFormatted as preset}
				<PresetListItem {...preset} />

				{#if preset.key === 'svelte-complete-distilled'}
					{#if loadingVersions}
						<div class="versions-status"><em>Loading previous distilled versions...</em></div>
					{:else if distilledError}
						<div class="versions-status error"><em>Error: {distilledError}</em></div>
					{:else if distilledVersions['svelte-complete-distilled']?.length > 0}
						<div class="distilled-versions">
							<details>
								<summary>Previous distilled versions</summary>
								<ul>
									{#each distilledVersions['svelte-complete-distilled'] as version}
										<li>
											<a href="/svelte-complete-distilled?version={version.date}">
												{version.date}
											</a>
											({version.sizeKb}KB)
										</li>
									{/each}
								</ul>
							</details>
						</div>
					{/if}
				{/if}
			{/each}
		</ul>

		<h2>Svelte 5</h2>
		<ul>
			<!-- Add the Svelte-only distilled preset at the top of the Svelte section -->
			<PresetListItem {...svelteDistilledPreset} />
			{#if loadingVersions}
				<div class="versions-status"><em>Loading previous distilled versions...</em></div>
			{:else if distilledError}
				<div class="versions-status error"><em>Error: {distilledError}</em></div>
			{:else if distilledVersions['svelte-distilled']?.length > 0}
				<div class="distilled-versions">
					<details>
						<summary>Previous distilled versions</summary>
						<ul>
							{#each distilledVersions['svelte-distilled'] as version}
								<li>
									<a href="/svelte-distilled?version={version.date}">
										{version.date}
									</a>
									({version.sizeKb}KB)
								</li>
							{/each}
						</ul>
					</details>
				</div>
			{/if}

			{#each sveltePresetsFormatted as preset}
				<PresetListItem {...preset} />
			{/each}
		</ul>

		<h2>SvelteKit</h2>
		<ul>
			<!-- Add the SvelteKit-only distilled preset at the top of the SvelteKit section -->
			<PresetListItem {...svelteKitDistilledPreset} />
			{#if loadingVersions}
				<div class="versions-status"><em>Loading previous distilled versions...</em></div>
			{:else if distilledError}
				<div class="versions-status error"><em>Error: {distilledError}</em></div>
			{:else if distilledVersions['sveltekit-distilled']?.length > 0}
				<div class="distilled-versions">
					<details>
						<summary>Previous distilled versions</summary>
						<ul>
							{#each distilledVersions['sveltekit-distilled'] as version}
								<li>
									<a href="/sveltekit-distilled?version={version.date}">
										{version.date}
									</a>
									({version.sizeKb}KB)
								</li>
							{/each}
						</ul>
					</details>
				</div>
			{/if}

			{#each svelteKitPresetsFormatted as preset}
				<PresetListItem {...preset} />
			{/each}
		</ul>

		<h2>Other</h2>
		<ul>
			{#each otherPresetsFormatted as preset}
				<PresetListItem {...preset} />
			{/each}
		</ul>

		<h2>Legacy</h2>
		<ul>
			<li>
				<a target="_blank" href="https://v4.svelte.dev/content.json">Svelte 4 Legacy + SvelteKit</a>
			</li>
		</ul>
	</section>

	<br />
	<details>
		<summary>MCP (Model Context Protocol) Endpoints - Experimental</summary>
		<p>Use these endpoints to connect this service to AI assistants that support MCP:</p>
		<ul>
			<li>
				<strong>SSE (Claude Desktop):</strong> <code>https://svelte-llm.khromov.se/mcp/sse</code>
			</li>
			<li>
				<strong>Streamable HTTP (most other clients):</strong>
				<code>https://svelte-llm.khromov.se/mcp/mcp</code>
			</li>
		</ul>
	</details>

	{#each instructions as { title, description, command }}
		<details>
			<summary>{title}</summary>
			<p>{@html description}</p>
			<pre><code>{command}</code></pre>
		</details>
	{/each}

	<br />
	<footer>
		Maintained by <a href="https://khromov.se" target="_blank">Stanislav Khromov</a>. Forked from
		<a target="_blank" href="https://twitter.com/didiercatz">Didier Catz</a>.
	</footer>
</main>

<style>
	main {
		max-width: 42em;
		margin: 15 auto;
	}

	details summary {
		cursor: pointer;
	}

	.distilled-versions {
		margin-left: 2em;
		margin-top: 0.25em;
		margin-bottom: 0.5em;
		font-size: 0.9em;
	}

	.versions-status {
		margin-left: 2em;
		margin-top: 0.25em;
		margin-bottom: 0.5em;
		font-size: 0.9em;
	}

	.error {
		color: #c41c1c;
	}

	.copy-link {
		margin-left: 8px;
		font-size: 0.85em;
		text-decoration: none;
	}

	.copy-link:hover {
		text-decoration: underline;
	}
</style>
