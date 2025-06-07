import type { RequestHandler } from './$types'
import { handler } from '$lib/mcpHandler'

export const GET: RequestHandler = async ({ request }) => {
	return handler(request)
}

export const POST: RequestHandler = async ({ request }) => {
	return handler(request)
}

export const DELETE: RequestHandler = async ({ request }) => {
	return handler(request)
}
