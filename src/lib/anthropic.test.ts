import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnthropicProvider } from './anthropic'

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
	env: {
		ANTHROPIC_API_KEY: 'test-api-key'
	}
}))

describe('AnthropicProvider', () => {
	let anthropic: AnthropicProvider
	let originalFetch: typeof global.fetch

	beforeEach(() => {
		// Save original fetch
		originalFetch = global.fetch
		// Initialize AnthropicProvider with a test model
		anthropic = new AnthropicProvider('test-model')
	})

	afterEach(() => {
		// Restore original fetch
		global.fetch = originalFetch
		// Clear all mocks
		vi.restoreAllMocks()
	})

	describe('getBatchStatus', () => {
		it('should retry on fetch errors up to maxRetries times', async () => {
			// Mock the fetch function to fail
			const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
			global.fetch = fetchMock

			// Set a shorter retry delay for the test
			const retryDelay = 10
			const maxRetries = 3

			// Call getBatchStatus and verify it rejects after maxRetries
			await expect(
				anthropic.getBatchStatus('test-batch-id', maxRetries, retryDelay)
			).rejects.toThrow(`Failed to get batch status after ${maxRetries} retries`)

			// Verify fetch was called exactly maxRetries + 1 times (initial attempt + retries)
			expect(fetchMock).toHaveBeenCalledTimes(maxRetries + 1)
		})

		it('should retry on unsuccessful responses up to maxRetries times', async () => {
			// Mock fetch to return an error response
			const fetchMock = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => 'Server error'
			})
			global.fetch = fetchMock

			// Set a shorter retry delay for the test
			const retryDelay = 10
			const maxRetries = 3

			// Call getBatchStatus and verify it rejects after maxRetries
			await expect(
				anthropic.getBatchStatus('test-batch-id', maxRetries, retryDelay)
			).rejects.toThrow(`Failed to get batch status after ${maxRetries} retries`)

			// Verify fetch was called exactly maxRetries + 1 times
			expect(fetchMock).toHaveBeenCalledTimes(maxRetries + 1)
		})

		it('should return batch status on successful response', async () => {
			// Mock successful batch response
			const mockResponse = {
				id: 'test-batch-id',
				type: 'batch',
				processing_status: 'ended',
				request_counts: {
					processing: 0,
					succeeded: 5,
					errored: 0,
					canceled: 0,
					expired: 0
				},
				ended_at: '2023-01-01T00:00:00Z',
				created_at: '2023-01-01T00:00:00Z',
				expires_at: '2023-01-02T00:00:00Z',
				cancel_initiated_at: null,
				results_url: 'https://api.anthropic.com/v1/results'
			}

			// Mock fetch to return success after initial failures
			const fetchMock = vi
				.fn()
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					statusText: 'Internal Server Error',
					text: async () => 'Server error'
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockResponse
				})

			global.fetch = fetchMock

			// Set a shorter retry delay for the test
			const retryDelay = 10

			// Call getBatchStatus
			const result = await anthropic.getBatchStatus('test-batch-id', 3, retryDelay)

			// Verify fetch was called twice (one failure, one success)
			expect(fetchMock).toHaveBeenCalledTimes(2)

			// Verify the returned value matches the mock response
			expect(result).toEqual(mockResponse)
		})

		it('should send correct headers and URL', async () => {
			// Mock successful response
			const mockResponse = {
				id: 'test-batch-id',
				type: 'batch',
				processing_status: 'ended',
				request_counts: {
					processing: 0,
					succeeded: 5,
					errored: 0,
					canceled: 0,
					expired: 0
				},
				ended_at: '2023-01-01T00:00:00Z',
				created_at: '2023-01-01T00:00:00Z',
				expires_at: '2023-01-02T00:00:00Z',
				cancel_initiated_at: null,
				results_url: 'https://api.anthropic.com/v1/results'
			}

			// Mock fetch to return success
			const fetchMock = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse
			})

			global.fetch = fetchMock

			// Call getBatchStatus
			await anthropic.getBatchStatus('test-batch-id')

			// Verify the request URL and headers
			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.anthropic.com/v1/messages/batches/test-batch-id',
				{
					method: 'GET',
					headers: {
						'x-api-key': 'test-api-key',
						'anthropic-version': '2023-06-01'
					}
				}
			)
		})
	})
})
