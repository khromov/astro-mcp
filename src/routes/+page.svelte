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

	let distilledVersions = $state<{ filename: string; date: string; path: string }[]>([])
	let loadingVersions = $state(true)
	let distilledError = $state<string | null>(null)

	onMount(async () => {
		try {
			loadingVersions = true
			const response = await fetch('/api/distilled-versions')
			if (response.ok) {
				distilledVersions = await response.json()
			} else {
				distilledError = `Failed to load versions: ${response.status} ${response.statusText}`
			}
		} catch (e) {
			console.error('Failed to load distilled versions:', e)
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
		<h2>Combined presets</h2>
		<em>
			Hand-picked combinations of the Svelte 5 + SvelteKit docs in a variety of sizes to fit
			different LLMs.
		</em>
		<ul>
			{#each combinedPresetsFormatted as preset}
				<PresetListItem {...preset} />

				{#if preset.key === 'svelte-complete-distilled' && distilledVersions.length > 0}
					<details class="distilled-versions">
						<summary>Previous distilled versions</summary>
						<ul>
							{#each distilledVersions as version}
								<li>
									<a href="/svelte-complete-distilled?version={version.date}">{version.date}</a>
								</li>
							{/each}
						</ul>
					</details>
				{:else if preset.key === 'svelte-complete-distilled' && loadingVersions}
					<p class="versions-status"><em>Loading previous distilled versions...</em></p>
				{:else if preset.key === 'svelte-complete-distilled' && distilledError}
					<p class="versions-status error"><em>Error: {distilledError}</em></p>
				{/if}
			{/each}
		</ul>

		<h2>Svelte 5</h2>
		<ul>
			{#each sveltePresetsFormatted as preset}
				<PresetListItem {...preset} />
			{/each}
		</ul>

		<h2>SvelteKit</h2>
		<ul>
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
</style>
