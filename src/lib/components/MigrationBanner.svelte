<script lang="ts">
	let { show = false }: { show: boolean } = $props()

	let dismissed = $state(false)

	function dismissBanner() {
		dismissed = true
	}
</script>

{#if show && !dismissed}
	<div class="migration-banner">
		<div class="banner-content">
			<div class="banner-message">
				<div class="banner-icon">🚀</div>
				<div class="banner-text">
					<p class="banner-title">We've moved to a new domain!</p>
					<p class="banner-description">
						This site is now available at <strong>svelte-llm.stanislav.garden</strong>. The old URL
						will continue to work, but please update your bookmarks and integrations.
					</p>
				</div>
			</div>
			<button class="banner-dismiss" onclick={dismissBanner} aria-label="Dismiss migration notice">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
					<path
						d="M13 1L1 13M1 1l12 12"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.migration-banner {
		background: linear-gradient(135deg, #ff3e00 0%, #ff6b35 100%);
		color: white;
		padding: 12px 0;
		position: relative;
		z-index: 100;
		box-shadow: 0 2px 8px rgba(255, 62, 0, 0.2);
	}

	.banner-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.banner-message {
		display: flex;
		align-items: center;
		gap: 16px;
		flex: 1;
	}

	.banner-icon {
		font-size: 24px;
		line-height: 1;
	}

	.banner-text {
		flex: 1;
	}

	.banner-title {
		margin: 0 0 4px 0;
		font-size: 16px;
		font-weight: 600;
		line-height: 1.3;
	}

	.banner-description {
		margin: 0;
		font-size: 14px;
		line-height: 1.4;
		opacity: 0.95;
	}

	.banner-description strong {
		font-weight: 600;
		color: rgba(255, 255, 255, 1);
	}

	.banner-dismiss {
		background: rgba(255, 255, 255, 0.2);
		border: none;
		color: white;
		padding: 8px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.banner-dismiss:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: translateY(-1px);
	}

	.banner-dismiss:active {
		transform: translateY(0);
	}

	@media (max-width: 768px) {
		.banner-content {
			padding: 0 16px;
		}

		.banner-message {
			gap: 12px;
		}

		.banner-icon {
			font-size: 20px;
		}

		.banner-title {
			font-size: 15px;
		}

		.banner-description {
			font-size: 13px;
		}
	}

	@media (max-width: 580px) {
		.banner-message {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.banner-icon {
			align-self: flex-start;
		}

		.banner-content {
			align-items: flex-start;
			gap: 12px;
		}

		.banner-dismiss {
			align-self: flex-start;
			margin-top: 4px;
		}
	}
</style>
