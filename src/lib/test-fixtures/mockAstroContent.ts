import type { DbContent } from '$lib/types/db'

/**
 * Mock Astro content data for testing MCP handlers
 * This represents typical documentation content from the database
 */
export const mockAstroContent: DbContent[] = [
	{
		id: 1,
		path: 'src/content/docs/en/getting-started.mdx',
		filename: 'getting-started.mdx',
		content:
			'# Getting Started\n\nAstro is a web framework for building fast, content-focused websites. Astro combines the developer experience of modern component frameworks with the performance of traditional static site generators.',
		size_bytes: 400,
		metadata: { title: 'Getting Started' },
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 2,
		path: 'src/content/docs/en/guides/routing.mdx',
		filename: 'routing.mdx',
		content:
			'# Routing\n\nAstro uses file-based routing to generate your build URLs based on the file layout of your project src/pages/ directory. When a file is added to the src/pages directory in your project, it is automatically available as a route based on its filename.',
		size_bytes: 300,
		metadata: { title: 'Routing' },
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 3,
		path: 'src/content/docs/en/guides/components.mdx',
		filename: 'components.mdx',
		content:
			'# Components\n\nAstro components are the basic building blocks of any Astro project. They are HTML-only templating components with no client-side runtime. You can spot an Astro component by its file extension: .astro.',
		size_bytes: 280,
		metadata: { title: 'Components' },
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 4,
		path: 'src/content/docs/en/guides/styling.mdx',
		filename: 'styling.mdx',
		content:
			'# Styling\n\nAstro was designed to make styling and CSS easy. Write CSS directly inside of an Astro component or import your favorite CSS library like Tailwind. Advanced styling languages like Sass and Less are also supported.',
		size_bytes: 270,
		metadata: { title: 'Styling' },
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 5,
		path: 'src/content/docs/en/reference/api-reference.mdx',
		filename: 'api-reference.mdx',
		content:
			'# API Reference\n\nThis reference covers the Astro API. If you are looking for guides and tutorials, check out our Guides section instead. The Astro API is built around modern web standards and includes support for ES modules, Web Components, and more.',
		size_bytes: 350,
		metadata: { title: 'API Reference' },
		created_at: new Date(),
		updated_at: new Date()
	}
]