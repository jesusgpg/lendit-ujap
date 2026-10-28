<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { push } from 'notivue'
import { apiRequest } from '../lib/api'
import VenezuelanBankField from './VenezuelanBankField.vue'
import type { CentralPaymentAccount } from '../types'

const form = ref({ holder: '', bank: '', phone: '', nationalId: '' })
const savedAccount = ref<CentralPaymentAccount | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const notice = ref('')

async function load() {
  isLoading.value = true
  error.value = ''
  try {
    const response = await apiRequest<{ ok: boolean; centralAccount: CentralPaymentAccount | null }>('/api/payments?view=admin-settings')
    savedAccount.value = response.centralAccount
    if (response.centralAccount) {
      form.value = {
        holder: response.centralAccount.holder,
        bank: response.centralAccount.bank,
        phone: response.centralAccount.phone,
        nationalId: response.centralAccount.nationalId,
      }
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la cuenta central.'
  } finally {
    isLoading.value = false
  }
}

async function save() {
  if (isSaving.value) return
  error.value = ''
  notice.value = ''

  const invalid: { label: string; selector: string }[] = []
  if (!form.value.holder.trim()) invalid.push({ label: 'titular de la cuenta', selector: 'input[autocomplete="name"]' })
  if (!form.value.bank.trim()) invalid.push({ label: 'banco receptor', selector: '.bank-field select' })
  if (!/^\+?[0-9][0-9 ()-]{6,28}$/.test(form.value.phone.trim())) invalid.push({ label: 'teléfono afiliado válido', selector: 'input[autocomplete="tel"]' })
  if (!/^[VE]-?\d{5,10}$/i.test(form.value.nationalId.trim())) invalid.push({ label: 'cédula del titular válida', selector: 'input[autocomplete="off"]' })
  if (invalid.length) {
    error.value = 'Completa estos datos: ' + invalid.map(field => field.label).join(', ') + '.'
    push.warning({ title: 'Completa los datos de la cuenta central', message: error.value })
    document.querySelector<HTMLElement>('.payment-settings ' + invalid[0]!.selector)?.focus()
    return
  }

  isSaving.value = true
  try {
    const response = await apiRequest<{ ok: boolean; centralAccount: CentralPaymentAccount }>('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ action: 'save-central-account', ...form.value }),
    })
    savedAccount.value = response.centralAccount
    form.value = {
      holder: response.centralAccount.holder,
      bank: response.centralAccount.bank,
      phone: response.centralAccount.phone,
      nationalId: response.centralAccount.nationalId,
    }
    notice.value = 'La cuenta central quedó actualizada y ya se muestra a quienes van a pagar.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la cuenta central.'
    push.error({ title: 'No se guardó la cuenta central', message: error.value })
  } finally {
    isSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="payment-settings" aria-labelledby="payment-settings-title" :aria-busy="isLoading || isSaving">
    <header class="payment-settings__intro">
      <span class="payment-settings__eyebrow">Pago Móvil centralizado</span>
      <h2 id="payment-settings-title">Cuenta receptora de LendIt</h2>
      <p>Configura aquí una sola cuenta institucional. La aplicación la mostrará a los miembros al recargar su wallet o pagar un alquiler.</p>
    </header>

    <p v-if="error" class="payment-settings__feedback payment-settings__feedback--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="payment-settings__feedback payment-settings__feedback--success" role="status">{{ notice }}</p>

    <form class="payment-settings__form" novalidate @submit.prevent="save">
      <label>Titular de la cuenta
        <input v-model.trim="form.holder" required minlength="2" maxlength="120" autocomplete="name" placeholder="Nombre del titular" />
      </label>
      <VenezuelanBankField v-model="form.bank" label="Banco receptor" />
      <div class="payment-settings__row">
        <label>Teléfono afiliado
          <input v-model.trim="form.phone" required type="tel" inputmode="tel" maxlength="30" autocomplete="tel" placeholder="0412-1234567" />
        </label>
        <label>Cédula del titular
          <input v-model.trim="form.nationalId" required maxlength="12" autocomplete="off" placeholder="V-12345678" />
        </label>
      </div>

      <aside class="payment-settings__note">
        Esta información es visible para los usuarios antes de transferir. Verifica titular, banco, teléfono y cédula antes de guardar.
      </aside>

      <footer class="payment-settings__actions">
        <button class="btn" type="button" :disabled="isLoading || isSaving" @click="load">Volver a cargar</button>
        <button class="btn btn--primary" type="submit" :disabled="isLoading || isSaving">
          {{ isSaving ? 'Guardando…' : savedAccount ? 'Guardar cambios' : 'Configurar cuenta' }}
        </button>
      </footer>
    </form>
  </section>
</template>

<style scoped>
.payment-settings{display:grid;gap:24px;max-width:760px}.payment-settings__intro{display:grid;gap:8px}.payment-settings__eyebrow{font:500 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}.payment-settings h2{margin:0;font:500 28px/1.2 var(--display);color:var(--ink)}.payment-settings p{margin:0;color:var(--ink-soft);font-size:14px;line-height:1.6}.payment-settings__form{display:grid;gap:18px;padding:22px;border:1px solid var(--line);border-radius:14px;background:var(--paper-2)}.payment-settings__form>label,.payment-settings__row>label{display:grid;gap:7px;font-size:13px;font-weight:600;color:var(--ink)}.payment-settings__form input{box-sizing:border-box;width:100%;min-height:45px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:9px;background:var(--paper);color:var(--ink);font:400 15px var(--sans)}.payment-settings__row{display:grid;grid-template-columns:1fr 1fr;gap:14px}.payment-settings__note{padding:14px;border:1px solid var(--gold);border-radius:10px;background:var(--gold-bg);color:var(--ink);font-size:13px;line-height:1.55}.payment-settings__feedback{padding:13px 15px;border-radius:10px;font-size:13px}.payment-settings__feedback--error{border:1px solid var(--crimson);color:var(--crimson-dark)}.payment-settings__feedback--success{border:1px solid var(--navy);color:var(--navy)}.payment-settings__actions{display:flex;justify-content:flex-end;gap:10px;padding-top:16px;border-top:1px solid var(--line)}.payment-settings :is(input,button):focus-visible{outline:2px solid var(--navy);outline-offset:3px}@media(max-width:560px){.payment-settings__row{grid-template-columns:1fr}.payment-settings__actions{flex-direction:column-reverse}.payment-settings__actions .btn{width:100%}}
</style>
