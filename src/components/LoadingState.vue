<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    compact?: boolean
  }>(),
  {
    label: 'Cargando información…',
    compact: false,
  },
)
</script>

<template>
  <div class="loading-state" :class="{ 'loading-state--compact': compact }" role="status" aria-live="polite">
    <span class="loading-state__spinner" aria-hidden="true"></span>
    <span class="loading-state__label">{{ label }}</span>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13px;
  min-height: 180px;
  padding: 30px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--gold-bg) 42%, transparent), transparent 48%),
    color-mix(in srgb, var(--paper-2) 60%, transparent);
  color: var(--ink-faint);
}

.loading-state--compact {
  min-height: 104px;
  padding: 20px;
}

.loading-state__spinner {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: conic-gradient(from 20deg, var(--crimson), var(--gold-light), transparent 72%);
  animation: loading-spin 0.95s linear infinite;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0);
  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0);
}

.loading-state__spinner::after {
  position: absolute;
  inset: 11px;
  border-radius: 50%;
  background: var(--crimson);
  content: '';
  animation: loading-pulse 1.4s ease-in-out infinite;
}

.loading-state__label {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes loading-pulse {
  0%,
  100% {
    transform: scale(0.65);
    opacity: 0.65;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-state__spinner,
  .loading-state__spinner::after {
    animation: none;
  }
}
</style>
