<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { push } from 'notivue'
import LoadingState from './LoadingState.vue'
import { usePaymentsStore } from '../stores/payments'
import { removeUnreferencedPaymentProof, uploadPaymentProof } from '../lib/paymentProof'
import VenezuelanBankField from './VenezuelanBankField.vue'
import type { LoanRequest, PaymentRecord } from '../types'

const props = defineProps<{ request: LoanRequest }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'completed', payment: PaymentRecord): void }>()
const paymentsStore = usePaymentsStore()

type ViewMode = 'form' | 'processing' | 'success' | 'failure'
type PaymentMethod = 'wallet' | 'mobile'
const viewMode = ref<ViewMode>('form')
const selectedMethod = ref<PaymentMethod>('mobile')
const paymentResult = ref<PaymentRecord | null>(null)
const failureReason = ref('')
const modalRef = ref<HTMLElement | null>(null)
const proofFile = ref<File | null>(null)
const paymentForm = ref({ bank: '', phone: '', nationalId: '', reference: '' })

const itemTitle = computed(() => props.request.item.title)
const itemCode = computed(() => props.request.item.code)
const categoryIcon = computed(() => props.request.item.categoryIcon || '📦')
const ownerName = computed(() => props.request.item.owner.name || props.request.item.owner.email)
const amount = computed(() => props.request.item.price ?? 0)
const currency = computed(() => props.request.item.currency ?? 'USD')
const walletBalance = computed(() => paymentsStore.balanceFor(currency.value))
const walletCanPay = computed(() => walletBalance.value >= amount.value)
const selectedExchangeRate = computed(() => currency.value === 'USD' || currency.value === 'EUR'
  ? paymentsStore.exchangeRates?.[currency.value] ?? null
  : null)
const transferAmountVES = computed(() => {
  if (currency.value === 'VES') return Math.round((amount.value + Number.EPSILON) * 100) / 100
  if (!selectedExchangeRate.value) return null
  return Math.round((amount.value * selectedExchangeRate.value + Number.EPSILON) * 100) / 100
})
const formattedTotal = computed(() => new Intl.NumberFormat('es-VE', {
  style: 'currency', currency: currency.value, maximumFractionDigits: 2,
}).format(amount.value))
const dateRangeDisplay = computed(() => {
  const date = new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' })
  const time = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' })
  const starts = new Date(props.request.startsAt)
  const ends = new Date(props.request.endsAt)
  return `${date.format(starts)} · ${time.format(starts)}–${time.format(ends)}`
})

function selectProof(event: Event) {
  const input = event.target as HTMLInputElement
  proofFile.value = input.files?.[0] ?? null
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && viewMode.value !== 'processing') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  modalRef.value?.focus()
  void paymentsStore.loadAccount().catch(() => undefined)
})
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

async function processCheckout() {
  if (paymentsStore.isProcessing) return
  viewMode.value = 'processing'
  failureReason.value = ''
  let proofPath: string | null = null
  try {
    let response
    if (selectedMethod.value === 'wallet') {
      response = await paymentsStore.submitWalletRental({ action: 'wallet-rental', requestId: props.request.id })
    } else {
      if (transferAmountVES.value === null) throw new Error('No hay una tasa BCV vigente disponible para convertir este pago. Inténtalo más tarde.')
      if (!proofFile.value) throw new Error('Adjunta el comprobante de Pago Móvil para continuar.')
      if (!paymentsStore.centralAccount) throw new Error('La cuenta central de LendIt no está configurada. No envíes un pago real.')
      proofPath = await uploadPaymentProof(proofFile.value)
      response = await paymentsStore.submitMobileRental({
        action: 'mobile-rental',
        requestId: props.request.id,
        proofPath,
        reference: paymentForm.value.reference,
        bank: paymentForm.value.bank,
        phone: paymentForm.value.phone,
        nationalId: paymentForm.value.nationalId,
      })
      proofPath = null
    }
    paymentResult.value = response.payment
    viewMode.value = 'success'
    emit('completed', response.payment)
    push.success({
      title: 'Pago aprobado',
      message: 'El propietario recibió una notificación y el importe se acreditó en su wallet.',
    })
  } catch (error) {
    if (proofPath) await removeUnreferencedPaymentProof(proofPath).catch(() => undefined)
    viewMode.value = 'failure'
    failureReason.value = error instanceof Error ? error.message : 'No se pudo validar el pago. Inténtalo de nuevo.'
  }
}

function retryCheckout() { viewMode.value = 'form' }
function finish() { emit('close') }
function formatBalance(value: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: currency.value, maximumFractionDigits: 2 }).format(value)
}
function formatBolivares(value: number) {
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}
function formatRate(value: number) {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 8 }).format(value)
}
function formatRateDate(value: string | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`))
}
</script>

<template>
  <Teleport to="body">
    <div class="checkout-backdrop" @click.self="viewMode !== 'processing' && $emit('close')">
      <section ref="modalRef" class="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title" tabindex="-1">
        <header class="checkout-header">
          <div><span class="checkout-eyebrow">Solicitud de alquiler</span><h2 id="checkout-title">{{ viewMode === 'success' ? 'Pago aprobado' : viewMode === 'failure' ? 'No se pudo completar' : 'Completa el pago' }}</h2></div>
          <button v-if="viewMode !== 'processing'" class="checkout-close" type="button" aria-label="Cerrar" @click="$emit('close')">×</button>
        </header>

        <div v-if="viewMode === 'form'" class="checkout-body">
          <section class="checkout-summary" aria-label="Resumen de la solicitud">
            <div class="checkout-summary__item"><span class="checkout-summary__icon" aria-hidden="true">{{ categoryIcon }}</span><div><span class="checkout-summary__code">{{ itemCode }}</span><strong>{{ itemTitle }}</strong><span>Propietario: {{ ownerName }}</span><span>{{ dateRangeDisplay }}</span></div></div>
            <div class="checkout-summary__total"><span>Total de la solicitud</span><strong>{{ formattedTotal }}</strong></div>
          </section>

          <p class="checkout-note">Validación académica: no se realiza un cobro bancario real.</p>

          <fieldset class="checkout-methods">
            <legend>¿Cómo quieres pagar?</legend>
            <label class="checkout-method" :class="{ 'checkout-method--selected': selectedMethod === 'mobile' }">
              <input v-model="selectedMethod" type="radio" name="payment-method" value="mobile" />
              <span><strong>Pago Móvil</strong><small>Adjunta el comprobante y los datos de referencia.</small></span>
            </label>
            <label class="checkout-method" :class="{ 'checkout-method--selected': selectedMethod === 'wallet' }" :aria-disabled="!walletCanPay">
              <input v-model="selectedMethod" type="radio" name="payment-method" value="wallet" :disabled="!walletCanPay" />
              <span><strong>Wallet LendIt</strong><small>Disponible: {{ formatBalance(walletBalance) }}<template v-if="!walletCanPay"> · saldo insuficiente</template></small></span>
            </label>
            <RouterLink v-if="!walletCanPay" class="checkout-wallet-link" to="/cuenta/pagos" @click="$emit('close')">Recargar wallet</RouterLink>
          </fieldset>

          <template v-if="selectedMethod === 'mobile'">
            <aside class="checkout-conversion" aria-live="polite">
              <template v-if="transferAmountVES !== null">
                <strong>Transferencia Pago Móvil: {{ formatBolivares(transferAmountVES) }}</strong>
                <p v-if="currency === 'VES'">El precio ya está expresado en bolívares; no requiere conversión.</p>
                <p v-else-if="selectedExchangeRate">1 {{ currency }} = Bs. {{ formatRate(selectedExchangeRate) }} · Tasa oficial BCV</p>
              </template>
              <p v-else-if="paymentsStore.isLoadingAccount" role="status">Consultando la tasa BCV vigente…</p>
              <p v-else role="alert">La tasa BCV de {{ currency }} no está disponible. No puedes continuar con Pago Móvil hasta obtener una tasa vigente.</p>
            </aside>
            <section v-if="paymentsStore.centralAccount" class="checkout-recipient" aria-labelledby="recipient-title">
              <h3 id="recipient-title">Cuenta central de LendIt</h3>
              <dl><div><dt>Titular</dt><dd>{{ paymentsStore.centralAccount.holder }}</dd></div><div><dt>Banco</dt><dd>{{ paymentsStore.centralAccount.bank }}</dd></div><div><dt>Teléfono</dt><dd>{{ paymentsStore.centralAccount.phone }}</dd></div><div><dt>Cédula</dt><dd>{{ paymentsStore.centralAccount.nationalId }}</dd></div></dl>
            </section>
            <p v-else class="checkout-warning" role="alert">Los datos de la cuenta central aún no están configurados. No hagas una transferencia real.</p>
            <fieldset class="checkout-payer">
              <legend>Datos del Pago Móvil enviado</legend>
              <p class="checkout-payer__note">Se usan para identificar esta transferencia y no se guardan en tu perfil.</p>
              <VenezuelanBankField v-model="paymentForm.bank" label="Banco de origen" />
              <div class="checkout-row"><label>Teléfono afiliado<input v-model.trim="paymentForm.phone" required type="tel" inputmode="tel" autocomplete="tel" placeholder="0412-1234567" /></label><label>Cédula del pagador<input v-model.trim="paymentForm.nationalId" required maxlength="12" placeholder="V-12345678" /></label></div>
              <label>Número de referencia<input v-model.trim="paymentForm.reference" required minlength="4" maxlength="60" autocomplete="off" /></label>
              <label class="checkout-upload">Comprobante de pago<input ref="proofInput" type="file" accept="image/jpeg,image/png,image/webp" required @change="selectProof" /><small>{{ proofFile?.name || 'JPG, PNG o WebP · máximo 5 MB' }}</small></label>
            </fieldset>
          </template>

          <p v-if="paymentsStore.error" class="checkout-error" role="alert">{{ paymentsStore.error }}</p>
          <footer class="checkout-actions"><button class="btn" type="button" @click="$emit('close')">Cancelar</button><button class="btn btn--primary" type="button" :disabled="paymentsStore.isProcessing || (selectedMethod === 'mobile' && (!paymentsStore.centralAccount || transferAmountVES === null))" @click="processCheckout">{{ selectedMethod === 'wallet' ? 'Pagar con wallet' : 'Validar Pago Móvil' }}</button></footer>
        </div>

        <div v-else-if="viewMode === 'processing'" class="checkout-state" aria-live="polite"><LoadingState label="Validando la operación…" /><p>Estamos registrando el resultado y actualizando las wallets.</p></div>

        <div v-else-if="viewMode === 'success'" class="checkout-state checkout-state--success" role="status">
          <span class="checkout-state__mark" aria-hidden="true">✓</span><h3>Pago aprobado</h3>
          <p>Se aprobó <strong>{{ formattedTotal }}</strong> para <em>{{ itemTitle }}</em>. El propietario recibió una notificación y el saldo se acreditó en su wallet.</p>
          <div v-if="paymentResult?.providerReference" class="checkout-receipt"><span>Referencia</span><code>{{ paymentResult.providerReference }}</code></div>
          <p v-if="paymentResult?.transferAmountVES !== null && paymentResult?.transferAmountVES !== undefined" class="checkout-state__transfer">Equivalente registrado en Pago Móvil: <strong>{{ formatBolivares(paymentResult.transferAmountVES) }}</strong><template v-if="paymentResult.exchangeRate && paymentResult.exchangeRateDate"> · Tasa BCV {{ formatBolivares(paymentResult.exchangeRate) }} por {{ currency }} del {{ formatRateDate(paymentResult.exchangeRateDate) }}</template></p>
          <p class="checkout-state__disclaimer">Esta aprobación pertenece al entorno académico de LendIt; no confirma una operación bancaria real.</p>
          <footer class="checkout-actions checkout-actions--center"><button class="btn btn--primary" type="button" @click="finish">Ver mis solicitudes</button></footer>
        </div>

        <div v-else class="checkout-state" role="alert"><span class="checkout-state__mark checkout-state__mark--error" aria-hidden="true">!</span><h3>No se pudo completar el pago</h3><p>{{ failureReason }}</p><footer class="checkout-actions checkout-actions--center"><button class="btn" type="button" @click="finish">Volver</button><button class="btn btn--primary" type="button" @click="retryCheckout">Intentar de nuevo</button></footer></div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.checkout-conversion{display:grid;gap:5px;padding:14px 16px;border:1px solid var(--navy);border-radius:10px;background:var(--navy-bg);color:var(--ink)}.checkout-conversion strong{font-size:15px;font-variant-numeric:tabular-nums}.checkout-conversion p{margin:0;color:var(--ink-soft);font-size:12px;line-height:1.55}.checkout-conversion a{color:var(--navy);font-weight:600}.checkout-state__transfer{padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--paper)}
.checkout-backdrop{position:fixed;inset:0;z-index:250;display:grid;place-items:center;padding:16px;background:color-mix(in srgb,var(--navy) 65%,transparent);backdrop-filter:blur(5px);overflow-y:auto}.checkout-dialog{width:min(100%,600px);max-height:min(92vh,920px);display:flex;flex-direction:column;overflow-y:auto;border:1px solid var(--line-strong);border-radius:18px;background:var(--paper-2);box-shadow:var(--shadow);padding:24px;outline:none}.checkout-header{display:flex;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--line)}.checkout-eyebrow{color:var(--gold);font:500 11px var(--mono);letter-spacing:.08em;text-transform:uppercase}.checkout-header h2{margin:6px 0 0;font:500 26px/1.2 var(--display);color:var(--ink)}.checkout-close{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:var(--paper);color:var(--ink);font-size:24px;cursor:pointer}.checkout-body{display:grid;gap:18px;padding-top:18px}.checkout-summary{display:grid;gap:15px;padding:16px;border:1px solid var(--line);border-radius:13px;background:var(--paper)}.checkout-summary__item{display:flex;gap:12px;align-items:flex-start}.checkout-summary__icon{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:10px;background:var(--navy-bg);font-size:21px}.checkout-summary__item>div{display:grid;gap:4px;min-width:0}.checkout-summary__item strong{font:500 19px var(--display)}.checkout-summary__item span:not(.checkout-summary__code){font-size:12px;color:var(--ink-soft)}.checkout-summary__code{font:500 10px var(--mono);color:var(--ink-soft)}.checkout-summary__total{display:flex;justify-content:space-between;gap:10px;padding-top:13px;border-top:1px solid var(--line);font-size:13px}.checkout-summary__total strong{font-size:18px}.checkout-note,.checkout-warning{padding:12px 14px;border-radius:10px;background:var(--gold-bg);color:var(--ink);font-size:13px;line-height:1.55}.checkout-methods,.checkout-payer{display:grid;gap:11px;min-width:0;margin:0;padding:0;border:0}.checkout-methods legend,.checkout-payer legend{margin-bottom:6px;font-size:14px;font-weight:700}.checkout-method{display:flex;gap:12px;align-items:flex-start;padding:13px;border:1px solid var(--line);border-radius:11px;background:var(--paper);cursor:pointer}.checkout-method--selected{border-color:var(--navy);box-shadow:0 0 0 1px var(--navy)}.checkout-method[aria-disabled=true]{opacity:.64}.checkout-method input{margin-top:4px;accent-color:var(--navy)}.checkout-method span{display:grid;gap:4px}.checkout-method strong{font-size:14px}.checkout-method small{font-size:12px;color:var(--ink-soft)}.checkout-wallet-link{justify-self:end;color:var(--navy);font-size:13px}.checkout-recipient{padding:14px;border:1px solid var(--line);border-radius:11px;background:var(--paper)}.checkout-recipient h3{margin:0 0 12px;font:500 17px var(--display)}.checkout-recipient dl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}.checkout-recipient dl div{display:grid;gap:4px}.checkout-recipient dt{font-size:11px;color:var(--ink-soft)}.checkout-recipient dd{margin:0;font-size:13px;font-weight:600;overflow-wrap:anywhere}.checkout-payer{padding:14px;border:1px solid var(--line);border-radius:11px}.checkout-payer label{display:grid;gap:6px;font-size:12px;font-weight:600}.checkout-payer input:not([type=checkbox]):not([type=file]){box-sizing:border-box;width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--line-strong);border-radius:8px;background:var(--paper);color:var(--ink);font:400 14px var(--sans)}.checkout-row{display:grid;grid-template-columns:1fr 1fr;gap:11px}.checkout-upload{padding:12px;border:1px dashed var(--line-strong);border-radius:9px;background:var(--paper-2)}.checkout-upload input{max-width:100%;font:400 12px var(--sans)}.checkout-upload small{font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}.checkout-remember input{accent-color:var(--navy)}.checkout-error{color:var(--crimson-dark);font-size:13px}.checkout-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:15px;border-top:1px solid var(--line)}.checkout-state{display:grid;justify-items:center;gap:14px;text-align:center;padding:28px 8px 6px}.checkout-state>p{max-width:430px;margin:0;color:var(--ink-soft);font-size:14px;line-height:1.65}.checkout-state h3{margin:0;font:500 25px var(--display)}.checkout-state__mark{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:var(--navy-bg);color:var(--navy);font-size:25px}.checkout-state__mark--error{background:var(--crimson-bg);color:var(--crimson-dark)}.checkout-receipt{display:grid;gap:6px;padding:12px 16px;border:1px solid var(--line);border-radius:9px}.checkout-receipt span{font-size:11px;color:var(--ink-soft)}.checkout-receipt code{font:500 13px var(--mono)}.checkout-state__disclaimer{font-size:12px!important}.checkout-actions--center{width:100%;justify-content:center;margin-top:8px}.checkout-dialog :is(button,input,a):focus-visible{outline:2px solid var(--navy);outline-offset:3px}.checkout-payer__note{margin:0;color:var(--ink-soft);font-size:12px;line-height:1.5}@media(max-width:560px){.checkout-dialog{padding:18px;max-height:95vh}.checkout-actions{flex-direction:column-reverse}.checkout-actions .btn{width:100%}.checkout-row,.checkout-recipient dl{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.checkout-dialog{scroll-behavior:auto}}
</style>
