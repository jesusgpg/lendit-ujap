<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { push } from 'notivue'
import { usePaymentsStore } from '../stores/payments'
import { removeUnreferencedPaymentProof, uploadPaymentProof } from '../lib/paymentProof'
import VenezuelanBankField from './VenezuelanBankField.vue'
import type { Currency, WalletTransaction } from '../types'

const payments = usePaymentsStore()
const currencies: Currency[] = ['USD', 'EUR', 'VES']
const topUpForm = ref({ amount: 10, currency: 'USD' as Currency, bank: '', phone: '', nationalId: '', reference: '' })
const topUpFormElement = ref<HTMLFormElement | null>(null)
const topUpErrorElement = ref<HTMLElement | null>(null)
const topUpIdempotencyKey = ref(crypto.randomUUID())
const proofFile = ref<File | null>(null)
const proofInput = ref<HTMLInputElement | null>(null)
const submittingTopUp = ref(false)
const topUpError = ref('')

const centralAccount = computed(() => payments.centralAccount)
const topUpExchangeRate = computed(() => topUpForm.value.currency === 'VES'
  ? null
  : payments.exchangeRates?.[topUpForm.value.currency] ?? null)
const topUpTransferAmountVES = computed(() => {
  const amount = Number(topUpForm.value.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (topUpForm.value.currency === 'VES') return Math.round((amount + Number.EPSILON) * 100) / 100
  if (!topUpExchangeRate.value) return null
  return Math.round((amount * topUpExchangeRate.value + Number.EPSILON) * 100) / 100
})

watch(() => [topUpForm.value.amount, topUpForm.value.currency], () => {
  topUpIdempotencyKey.value = crypto.randomUUID()
})

async function loadAccount() {
  try {
    await payments.loadAccount()
  } catch {
    // The panel renders the store's retryable account error.
  }
}

function chooseProof(event: Event) {
  const input = event.target as HTMLInputElement
  proofFile.value = input.files?.[0] ?? null
  topUpError.value = ''
}

function describeTransaction(transaction: WalletTransaction) {
  if (transaction.type === 'WALLET_TOP_UP') return 'Recarga de saldo'
  if (transaction.type === 'RENTAL_CREDIT') return 'Pago recibido por un alquiler'
  if (transaction.type === 'RENTAL_REFUND') return 'Reintegro a tu wallet'
  if (transaction.type === 'RENTAL_REVERSAL') return 'Reverso de pago'
  return transaction.description || 'Pago de alquiler'
}

function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}

function formatBolivares(amount: number) {
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
}

function formatExchangeRate(rate: number) {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 8 }).format(rate)
}

function transactionAmount(transaction: WalletTransaction) {
  const value = ['RENTAL_DEBIT', 'RENTAL_REVERSAL'].includes(transaction.type) ? -Math.abs(transaction.amount) : Math.abs(transaction.amount)
  return `${value > 0 ? '+' : ''}${formatMoney(value, transaction.currency)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function validateTopUp(): { message: string; selector: string } | null {
  const missing: { label: string; selector: string }[] = []
  if (!topUpForm.value.bank.trim()) missing.push({ label: 'banco de origen', selector: '.bank-field select' })
  if (!/^\+?[0-9][0-9 ()-]{6,28}$/.test(topUpForm.value.phone.trim())) missing.push({ label: 'teléfono de origen válido', selector: 'input[type="tel"]' })
  if (!/^[VE]-?\d{5,10}$/i.test(topUpForm.value.nationalId.trim())) missing.push({ label: 'cédula del pagador válida', selector: 'input[placeholder="V-12345678"]' })
  if (topUpForm.value.reference.trim().length < 4) missing.push({ label: 'referencia bancaria (mínimo 4 caracteres)', selector: 'input[placeholder="Referencia bancaria"]' })
  if (!proofFile.value) missing.push({ label: 'comprobante de Pago Móvil', selector: 'input[type="file"]' })
  const amount = Number(topUpForm.value.amount)
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    missing.push({ label: 'monto válido (entre 1 y 100.000, máximo dos decimales)', selector: 'input[type="number"]' })
  }
  if (missing.length) {
    return {
      message: 'No se envió la recarga. Completa o corrige: ' + missing.map(field => field.label).join(', ') + '.',
      selector: missing[0]?.selector ?? '',
    }
  }

  if (!centralAccount.value) return { message: 'No se envió la recarga. Administración todavía no configuró la cuenta receptora de LendIt.', selector: '' }
  if (topUpTransferAmountVES.value === null) return { message: 'No se envió la recarga. No hay una tasa oficial BCV disponible para calcular la transferencia.', selector: '' }
  return null
}

async function topUp() {
  topUpError.value = ''
  const validation = validateTopUp()
  if (validation) {
    topUpError.value = validation.message
    push.warning({ title: 'No se envió la recarga', message: validation.message })
    await nextTick()
    if (validation.selector) topUpFormElement.value?.querySelector<HTMLElement>(validation.selector)?.focus()
    else topUpErrorElement.value?.focus()
    return
  }

  submittingTopUp.value = true
  let proofPath: string | null = null
  try {
    proofPath = await uploadPaymentProof(proofFile.value!)
    await payments.submitWalletTopUp({
      action: 'wallet-top-up',
      idempotencyKey: topUpIdempotencyKey.value,
      amount: Number(topUpForm.value.amount),
      currency: topUpForm.value.currency,
      proofPath,
      reference: topUpForm.value.reference.trim(),
      bank: topUpForm.value.bank.trim(),
      phone: topUpForm.value.phone.trim(),
      nationalId: topUpForm.value.nationalId.trim(),
    })
    proofPath = null
    proofFile.value = null
    topUpIdempotencyKey.value = crypto.randomUUID()
    if (proofInput.value) proofInput.value.value = ''
    topUpForm.value = { amount: 10, currency: 'USD', bank: '', phone: '', nationalId: '', reference: '' }
    push.success({ title: 'Recarga aprobada', message: 'El saldo quedó acreditado en tu wallet.' })
  } catch (error) {
    topUpError.value = error instanceof Error ? error.message : 'No se pudo validar la recarga. Inténtalo de nuevo.'
    push.error({ title: 'No se completó la recarga', message: topUpError.value })
    if (proofPath) await removeUnreferencedPaymentProof(proofPath).catch(() => undefined)
  } finally {
    submittingTopUp.value = false
  }
}
onMounted(loadAccount)
</script>

<template>
  <section class="payments-panel" aria-labelledby="payments-title" :aria-busy="payments.isLoadingAccount || submittingTopUp">
    <header class="payments-panel__heading">
      <span class="payments-panel__eyebrow">Saldo y transferencias</span>
      <h2 id="payments-title">Wallet LendIt</h2>
      <p>Consulta tu wallet, recibe ingresos por alquileres y recarga a la cuenta central de LendIt.</p>
    </header>

    <div v-if="payments.accountError" class="payments-panel__feedback" role="alert">
      <span>{{ payments.accountError }}</span>
      <button class="btn" type="button" @click="loadAccount">Reintentar</button>
    </div>

    <section class="wallet-balances" aria-label="Saldos disponibles">
      <article v-for="currency in currencies" :key="currency" class="wallet-balance">
        <span>{{ currency }}</span>
        <strong>{{ formatMoney(payments.balanceFor(currency), currency) }}</strong>
        <small>{{ payments.balanceFor(currency) < 0 ? 'Saldo pendiente de recuperar' : 'Saldo disponible' }}</small>
      </article>
    </section>

    <section class="payments-panel__section" aria-labelledby="central-account-title">
      <div class="payments-panel__section-heading">
        <div><h3 id="central-account-title">Cuenta central de LendIt</h3><p>Transfiere aquí para recargar tu wallet. Administración mantiene estos datos.</p></div>
      </div>
      <dl v-if="centralAccount" class="central-account">
        <div><dt>Titular</dt><dd>{{ centralAccount.holder }}</dd></div>
        <div><dt>Banco</dt><dd>{{ centralAccount.bank }}</dd></div>
        <div><dt>Teléfono</dt><dd>{{ centralAccount.phone }}</dd></div>
        <div><dt>Cédula</dt><dd>{{ centralAccount.nationalId }}</dd></div>
      </dl>
      <p v-else class="payments-panel__notice" role="status">Los datos de la cuenta central todavía deben configurarse. No hagas transferencias hasta que aparezcan aquí.</p>
      <p class="payments-panel__demo-note">La validación de esta versión es académica; no se conecta a un banco ni realiza cobros reales.</p>
    </section>

    <section class="payments-panel__section" aria-labelledby="top-up-title">
      <div class="payments-panel__section-heading">
        <div><h3 id="top-up-title">Recargar saldo</h3><p>Transfiere a LendIt y adjunta los datos de esta operación para identificar el pago.</p></div>
      </div>
      <form ref="topUpFormElement" class="payments-form" novalidate @submit.prevent="topUp">
        <div class="payments-form__row">
          <label>Monto<input v-model.number="topUpForm.amount" type="number" min="1" max="100000" step="0.01" required inputmode="decimal" /></label>
          <label>Moneda<select v-model="topUpForm.currency"><option value="USD">USD · dólares</option><option value="EUR">EUR · euros</option><option value="VES">VES · bolívares</option></select></label>
        </div>
        <aside class="payment-conversion" aria-live="polite">
          <template v-if="topUpTransferAmountVES !== null">
            <strong>Debes transferir {{ formatBolivares(topUpTransferAmountVES) }}</strong>
            <p v-if="topUpForm.currency === 'VES'">El monto ya está expresado en bolívares; no requiere conversión.</p>
            <p v-else-if="topUpExchangeRate">1 {{ topUpForm.currency }} = Bs. {{ formatExchangeRate(topUpExchangeRate) }} · Tasa oficial BCV</p>
          </template>
          <p v-else-if="payments.isLoadingAccount" role="status">Consultando la tasa BCV vigente…</p>
          <p v-else role="alert">No se pudo consultar una tasa BCV vigente para {{ topUpForm.currency }}. La recarga en esta moneda está temporalmente deshabilitada.</p>
        </aside>
        <p class="payments-panel__transaction-note">Los datos del pagador se usan solo para identificar esta transferencia; no se guardan en tu perfil.</p>
        <div class="payments-form__row">
          <VenezuelanBankField v-model="topUpForm.bank" label="Banco de origen" />
          <label>Teléfono de origen<input v-model.trim="topUpForm.phone" type="tel" inputmode="tel" required maxlength="30" placeholder="0412-1234567" /></label>
        </div>
        <div class="payments-form__row">
          <label>Cédula del pagador<input v-model.trim="topUpForm.nationalId" required maxlength="12" placeholder="V-12345678" /></label>
          <label>Número de referencia<input v-model.trim="topUpForm.reference" required minlength="4" maxlength="60" autocomplete="off" placeholder="Referencia bancaria" /></label>
        </div>
        <label class="payments-form__upload">Comprobante de Pago Móvil
          <input ref="proofInput" type="file" accept="image/jpeg,image/png,image/webp" required @change="chooseProof" />
          <small>{{ proofFile?.name || 'JPG, PNG o WebP · máximo 5 MB' }}</small>
        </label>
        <p v-if="topUpError" ref="topUpErrorElement" class="payments-panel__error" role="alert" tabindex="-1">{{ topUpError }}</p>
        <button class="btn btn--primary" type="submit" :disabled="submittingTopUp">
          {{ submittingTopUp ? 'Validando…' : `Confirmar recarga de ${formatMoney(Number(topUpForm.amount) || 0, topUpForm.currency)}` }}
        </button>
      </form>
    </section>

    <section class="payments-panel__section" aria-labelledby="wallet-history-title">
      <div class="payments-panel__section-heading">
        <div><h3 id="wallet-history-title">Movimientos recientes</h3><p>Recargas y pagos recibidos o realizados desde tu wallet.</p></div>
        <button class="btn" type="button" :disabled="payments.isLoadingAccount" @click="loadAccount">Actualizar</button>
      </div>
      <p v-if="payments.isLoadingAccount && !payments.walletTransactions.length" class="payments-panel__empty">Cargando movimientos…</p>
      <p v-else-if="!payments.walletTransactions.length" class="payments-panel__empty">Aún no tienes movimientos en la wallet.</p>
      <ul v-else class="wallet-history">
        <li v-for="transaction in payments.walletTransactions" :key="transaction.id" class="wallet-history__row">
          <span class="wallet-history__mark" :class="{ 'wallet-history__mark--debit': ['RENTAL_DEBIT', 'RENTAL_REVERSAL'].includes(transaction.type) }" aria-hidden="true">{{ ['RENTAL_DEBIT', 'RENTAL_REVERSAL'].includes(transaction.type) ? '−' : '+' }}</span>
          <span class="wallet-history__description"><strong>{{ describeTransaction(transaction) }}</strong><small>{{ transaction.description || 'LendIt UJAP' }} · {{ formatDate(transaction.createdAt) }}</small></span>
          <strong class="wallet-history__amount" :class="{ 'wallet-history__amount--debit': ['RENTAL_DEBIT', 'RENTAL_REVERSAL'].includes(transaction.type) }">{{ transactionAmount(transaction) }}</strong>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.payment-conversion{display:grid;gap:5px;padding:14px 16px;border:1px solid var(--navy);border-radius:10px;background:var(--navy-bg);color:var(--ink)}.payment-conversion strong{font-size:15px;font-variant-numeric:tabular-nums}.payment-conversion p{font-size:12px}.payment-conversion a{color:var(--navy);font-weight:600}
.payments-panel{display:grid;gap:30px;min-width:0}.payments-panel__heading{padding-bottom:22px;border-bottom:1px solid var(--line)}.payments-panel__eyebrow{font:500 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}.payments-panel h2{margin:8px 0;font:500 30px/1.15 var(--display);letter-spacing:-.025em}.payments-panel h3{margin:0 0 7px;font:500 21px/1.25 var(--display)}.payments-panel p{margin:0;color:var(--ink-soft);font-size:14px;line-height:1.6}.wallet-balances{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.wallet-balance{display:grid;gap:7px;min-width:0;padding:18px;border:1px solid var(--line);border-radius:13px;background:var(--paper-2)}.wallet-balance>span{font:500 11px var(--mono);letter-spacing:.08em;color:var(--ink-soft)}.wallet-balance strong{font-size:clamp(18px,2.2vw,25px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.wallet-balance small{font-size:12px;color:var(--ink-soft)}.payments-panel__section{display:grid;gap:18px;padding-top:26px;border-top:1px solid var(--line)}.payments-panel__section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.payments-panel__saved-tag{flex:0 0 auto;padding:6px 10px;border-radius:999px;background:var(--navy-bg);color:var(--navy);font-size:12px;font-weight:600}.central-account{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0;padding:18px;border:1px solid var(--line);border-radius:12px;background:var(--paper-2)}.central-account>div{display:grid;gap:5px;min-width:0}.central-account dt{font-size:12px;color:var(--ink-soft)}.central-account dd{margin:0;font-size:14px;font-weight:600;overflow-wrap:anywhere}.payments-panel__notice{padding:14px;border:1px solid var(--gold);border-radius:10px;background:var(--gold-bg);color:var(--ink)!important}.payments-panel__demo-note{font-size:12px!important}.payments-form{display:grid;gap:16px}.payments-form label{display:grid;gap:7px;min-width:0;font-size:13px;font-weight:600}.payments-form :is(input:not([type=file]),select){box-sizing:border-box;width:100%;min-height:45px;border:1px solid var(--line-strong);border-radius:9px;background:var(--paper);color:var(--ink);font:400 15px var(--sans);padding:10px 12px}.payments-form__row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.payments-form__upload{padding:14px;border:1px dashed var(--line-strong);border-radius:10px;background:var(--paper-2)}.payments-form__upload input{max-width:100%;font:400 13px var(--sans)}.payments-form__upload small{font-size:12px;font-weight:400;color:var(--ink-soft);overflow-wrap:anywhere}.payments-panel__error{color:var(--crimson-dark)!important}.payments-panel__success{color:var(--navy)!important}.payments-panel__feedback{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px;border:1px solid var(--crimson);border-radius:10px;color:var(--crimson-dark)}.payments-panel__empty{padding:18px;border-radius:10px;background:var(--paper-2);text-align:center}.wallet-history{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}.wallet-history__row{display:flex;align-items:center;gap:12px;padding:15px 2px;border-bottom:1px solid var(--line)}.wallet-history__mark{display:grid;place-items:center;width:34px;height:34px;flex:0 0 auto;border-radius:50%;background:var(--navy-bg);color:var(--navy);font-size:19px}.wallet-history__mark--debit{background:var(--crimson-bg);color:var(--crimson-dark)}.wallet-history__description{display:grid;gap:4px;min-width:0;flex:1}.wallet-history__description strong{font-size:13px}.wallet-history__description small{font-size:11px;color:var(--ink-soft);line-height:1.5;overflow-wrap:anywhere}.wallet-history__amount{white-space:nowrap;color:var(--navy);font-size:14px;font-variant-numeric:tabular-nums}.wallet-history__amount--debit{color:var(--crimson-dark)}.payments-panel :is(a,button,input,select):focus-visible{outline:2px solid var(--navy);outline-offset:3px}.payments-panel__transaction-note{padding:12px 14px;border:1px solid var(--line);border-radius:9px;background:var(--paper-2);font-size:12px!important}@media(max-width:600px){.wallet-balances{grid-template-columns:1fr}.wallet-balance{grid-template-columns:1fr auto;align-items:center}.wallet-balance small{grid-column:1/-1}.payments-form__row,.central-account{grid-template-columns:1fr}.payments-panel__section-heading{align-items:flex-start}.wallet-history__row{align-items:flex-start}.wallet-history__amount{font-size:12px}.payments-panel__feedback{align-items:flex-start;flex-direction:column}}
.payments-panel__error{padding:12px 14px;border:1px solid var(--crimson);border-radius:10px;background:var(--crimson-bg);color:var(--crimson-dark)!important}.payments-panel__error:focus{outline:2px solid var(--navy);outline-offset:3px}
</style>
