<script setup lang="ts">
import { Notivue, NotivueSwipe, Notification, NotificationProgress, type NotivueTheme } from 'notivue'

const lenditTheme: NotivueTheme = {
  '--nv-width': '360px',
  '--nv-spacing': '0.875rem',
  '--nv-radius': '0.75rem',
  '--nv-border-width': '1px',
  '--nv-icon-size': '0.9rem',
  '--nv-shadow': '0 14px 34px rgba(15, 26, 46, 0.16)',
  '--nv-tip-width': '3px',
  '--nv-progress-height': '3px',
  '--nv-global-bg': 'var(--paper-2)',
  '--nv-global-fg': 'var(--ink)',
  '--nv-global-border': 'var(--line-strong)',
  '--nv-success-accent': 'var(--gold)',
  '--nv-info-accent': 'var(--crimson)',
  '--nv-warning-accent': '#b7791f',
  '--nv-error-accent': 'var(--crimson-dark)',
}
</script>

<template>
  <Notivue v-slot="item">
    <NotivueSwipe :item="item">
      <Notification :item="item" :theme="lenditTheme" close-aria-label="Cerrar notificación">
        <NotificationProgress :item="item" />
      </Notification>
    </NotivueSwipe>
  </Notivue>
  <router-view />
</template>

<style>
.Notivue__close {
  opacity: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--paper) 62%, transparent);
  transition: background 0.15s ease, color 0.15s ease;
}

.Notivue__close-icon {
  width: 11px;
  height: 11px;
}

.Notivue__close:hover {
  background: var(--crimson-bg);
  color: var(--crimson-dark);
}
</style>
