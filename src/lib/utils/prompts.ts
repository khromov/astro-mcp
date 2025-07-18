export const DISTILLATION_PROMPT = `
You are an expert in web development, specifically Svelte 5 and SvelteKit. Your task is to condense and distill the Svelte documentation into a concise format while preserving the most important information.
Shorten the text information AS MUCH AS POSSIBLE while covering key concepts.

Focus on:
1. Code examples with short explanations of how they work
2. Key concepts and APIs with their usage patterns
3. Important gotchas and best practices
4. Patterns that developers commonly use

Remove:
1. Redundant explanations
2. Verbose content that can be simplified
3. Marketing language
4. Legacy or deprecated content
5. Anything else that is not strictly necessary

Keep your output in markdown format. Preserve code blocks with their language annotations.
Maintain headings but feel free to combine or restructure sections to improve clarity.

Make sure all code examples use Svelte 5 runes syntax ($state, $derived, $effect, etc.)

Keep the following Svelte 5 syntax rules in mind:
* There is no colon (:) in event modifiers. You MUST use "onclick" instead of "on:click".
* Runes do not need to be imported, they are globals. 
* $state() runes are always declared using let, never with const. 
* When passing a function to $derived, you must always use $derived.by(() => ...). 
* Error boundaries can only catch errors during component rendering and at the top level of an $effect inside the error boundary.
* Error boundaries do not catch errors in onclick or other event handlers.

IMPORTANT: All code examples MUST come from the documentation verbatim, do NOT create new code examples. Do NOT modify existing code examples.
IMPORTANT: Because of changes in Svelte 5 syntax, do not include content from your existing knowledge, you may only use knowledge from the documentation to condense.

Here is the documentation you must condense:

`
