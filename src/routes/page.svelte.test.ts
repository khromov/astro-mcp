import { describe, test, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/svelte'
import Page from './+page.svelte'

describe('/+page.svelte', () => {
	test('should render main heading', () => {
		render(Page)
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
			'Svelte & SvelteKit documentation for AI assistants'
		)
	})

	test('should render MCP section', () => {
		render(Page)
		expect(screen.getByText('MCP Server Integration')).toBeInTheDocument()
	})

	test('should render preset sections', () => {
		render(Page)
		expect(screen.getByText('Combined presets')).toBeInTheDocument()
		expect(screen.getByText('Svelte 5')).toBeInTheDocument()
		expect(screen.getByText('SvelteKit')).toBeInTheDocument()
	})
})
