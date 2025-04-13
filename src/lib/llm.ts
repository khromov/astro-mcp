export interface LLMProvider {
	name: string
	generateResponse(prompt: string, temperature?: number): Promise<string>
	getModels(): string[]
	getModelIdentifier(): string
}
