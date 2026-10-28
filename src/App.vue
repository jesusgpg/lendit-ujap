<script setup lang="ts">
import { Notivue, NotivueSwipe, Notification, NotificationProgress, type NotivueTheme } from 'notivue'
import { useMessageNotifications } from './composables/useMessageNotifications'
import { useWalletNotifications } from './composables/useWalletNotifications'
import { useNativeFormAlerts } from './composables/useNativeFormAlerts'

useMessageNotifications()
useWalletNotifications()
const { formAlert, dismissFormAlert } = useNativeFormAlerts()

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
  '--nv-info-accent': 'var(--navy)',
  '--nv-warning-accent': '#b7791f',
  '--nv-error-accent': 'var(--crimson-dark)',
}
</script>

<template>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
  <Notivue v-slot="item">
    <NotivueSwipe :item="item">
      <Notification :item="item" :theme="lenditTheme" close-aria-label="Cerrar notificación">
        <NotificationProgress :item="item" />
      </Notification>
    </NotivueSwipe>
  </Notivue>
  <Transition name="form-alert">
    <aside v-if="formAlert" class="global-form-alert" role="alert" aria-live="assertive" aria-atomic="true">
      <span class="global-form-alert__mark" aria-hidden="true">!</span>
      <div class="global-form-alert__content">
        <strong>Revisa los datos obligatorios</strong>
        <p>{{ formAlert }}</p>
      </div>
      <button class="global-form-alert__close" type="button" aria-label="Cerrar alerta" @click="dismissFormAlert">×</button>
    </aside>
  </Transition>
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

.global-form-alert {
  position: fixed;
  z-index: 1200;
  top: max(76px, calc(64px + env(safe-area-inset-top)));
  right: max(16px, env(safe-area-inset-right));
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 28px;
  align-items: start;
  gap: 12px;
  width: min(440px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid var(--gold);
  border-left: 4px solid var(--gold);
  border-radius: 12px;
  background: var(--paper-2);
  color: var(--ink);
  box-shadow: var(--shadow);
}

.global-form-alert__mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gold-bg);
  color: var(--gold);
  font-weight: 800;
}

.global-form-alert__content { display: grid; gap: 4px; min-width: 0; }
.global-form-alert__content strong { font-size: 14px; }
.global-form-alert__content p { margin: 0; color: var(--ink-soft); font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
.global-form-alert__close { width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: var(--ink-soft); font-size: 20px; cursor: pointer; }
.global-form-alert__close:hover { background: var(--paper); color: var(--ink); }
.global-form-alert :is(button):focus-visible { outline: 2px solid var(--navy); outline-offset: 3px; }
.form-alert-enter-active, .form-alert-leave-active { transition: opacity .16s ease, transform .16s ease; }
.form-alert-enter-from, .form-alert-leave-to { opacity: 0; transform: translateY(-6px); }

@media (prefers-reduced-motion: reduce) {
  .form-alert-enter-active, .form-alert-leave-active { transition: none; }
}
</style>
