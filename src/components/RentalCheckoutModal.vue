<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { push } from 'notivue'
import LoadingState from './LoadingState.vue'
import { usePaymentsStore } from '../stores/payments'
import type { FakePaymentMethod, LoanRequest, PaymentRecord, SimulationOutcome } from '../types'

const props = defineProps<{
  request: LoanRequest
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'completed', payment: PaymentRecord): void
}>()

const paymentsStore = usePaymentsStore()

type ViewMode = 'form' | 'processing' | 'success' | 'failure'

const viewMode = ref<ViewMode>('form')
const selectedMethod = ref<FakePaymentMethod>('campus_balance')
const selectedOutcome = ref<SimulationOutcome>('success')
const paymentResult = ref<PaymentRecord | null>(null)
const failureReason = ref<string>('')
const modalRef = ref<HTMLElement | null>(null)

const itemTitle = computed(() => props.request.item.title)
const itemCode = computed(() => props.request.item.code)
const categoryIcon = computed(() => props.request.item.categoryIcon || '📦')
const ownerName = computed(() => props.request.item.owner.name || props.request.item.owner.email)

const amount = computed(() => props.request.item.price ?? 0)
const currency = computed(() => props.request.item.currency ?? 'USD')

const formattedTotal = computed(() => {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: currency.value,
    maximumFractionDigits: 2,
  }).format(amount.value)
})

const dateRangeDisplay = computed(() => {
  const date = new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' })
  const time = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' })
  const starts = new Date(props.request.startsAt)
  const ends = new Date(props.request.endsAt)
  return `${date.format(starts)} · ${time.format(starts)}–${time.format(ends)}`
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (viewMode.value !== 'processing') {
      emit('close')
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  // Autofocus modal container for keyboard accessibility
  modalRef.value?.focus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

async function processCheckout() {
  viewMode.value = 'processing'
  failureReason.value = ''

  try {
    // Artificial brief pause to provide tactile user feedback for the simulated gateway
    await new Promise((resolve) => setTimeout(resolve, 650))

    const response = await paymentsStore.simulatePayment({
      requestId: props.request.id,
      outcome: selectedOutcome.value,
      paymentMethod: selectedMethod.value,
    })

    if (response.simulatedFailure || response.payment.status === 'FAILED') {
      viewMode.value = 'failure'
      failureReason.value =
        response.message ||
        'Simulación de rechazo: Fondos demo insuficientes o bloqueo preventivo del emisor de pruebas.'
      paymentResult.value = response.payment
      emit('completed', response.payment)
    } else {
      viewMode.value = 'success'
      paymentResult.value = response.payment
      emit('completed', response.payment)
      push.success({
        title: 'Pago simulado completado',
        message: 'Tu solicitud ya cuenta con el pago simulado registrado y está lista para aprobación.',
      })
    }
  } catch (error) {
    viewMode.value = 'failure'
    failureReason.value =
      error instanceof Error ? error.message : 'Error inesperado al contactar el servicio de simulación.'
  }
}

function retryCheckout() {
  viewMode.value = 'form'
  selectedOutcome.value = 'success'
}

function finish() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="checkout-backdrop"
      @click.self="viewMode !== 'processing' && $emit('close')"
    >
      <div
        ref="modalRef"
        class="checkout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        tabindex="-1"
      >
        <!-- Header -->
        <header class="checkout-header">
          <div class="checkout-header__title">
            <span class="checkout-badge">Simulación académica</span>
            <h2 id="checkout-title">
              {{
                viewMode === 'success'
                  ? 'Pago simulado aprobado'
                  : viewMode === 'failure'
                    ? 'Simulación de pago no completada'
                    : 'Checkout de alquiler'
              }}
            </h2>
          </div>
          <button
            v-if="viewMode !== 'processing'"
            class="checkout-close"
            type="button"
            aria-label="Cerrar modal de checkout"
            @click="$emit('close')"
          >
            ×
          </button>
        </header>

        <!-- Form view -->
        <div v-if="viewMode === 'form'" class="checkout-body">
          <!-- Item & Pricing Summary -->
          <section class="checkout-summary" aria-label="Resumen del alquiler">
            <div class="checkout-summary__item">
              <span class="checkout-summary__icon" aria-hidden="true">{{ categoryIcon }}</span>
              <div class="checkout-summary__meta">
                <span class="checkout-summary__code">{{ itemCode }}</span>
                <strong>{{ itemTitle }}</strong>
                <span>Propietario: {{ ownerName }}</span>
                <span class="checkout-summary__date">{{ dateRangeDisplay }}</span>
              </div>
            </div>

            <div class="checkout-pricing">
              <div class="checkout-pricing__row">
                <span>Tarifa de alquiler</span>
                <strong>{{ formattedTotal }}</strong>
              </div>
              <div class="checkout-pricing__row checkout-pricing__row--free">
                <span>Comisión de plataforma LendIt UJAP</span>
                <strong>Gratis ($0.00)</strong>
              </div>
              <div class="checkout-pricing__row checkout-pricing__row--total">
                <span>Total a debitar (Simulado)</span>
                <strong class="checkout-pricing__amount">{{ formattedTotal }}</strong>
              </div>
            </div>
          </section>

          <!-- Safe simulation alert -->
          <aside class="checkout-notice" role="note">
            <span class="checkout-notice__icon" aria-hidden="true">ℹ</span>
            <div class="checkout-notice__content">
              <strong>Entorno 100% de prueba académica</strong>
              <p>
                No se solicitan datos financieros reales ni se realizarán cobros a tus cuentas.
                Esta transacción utiliza un saldo demo de la UJAP para registrar el estado
                <code>SIMULATED_PAID</code>.
              </p>
            </div>
          </aside>

          <!-- Fake Payment Method Selection -->
          <fieldset class="checkout-fieldset">
            <legend class="checkout-legend">Método de pago simulado</legend>
            <div class="checkout-options" role="radiogroup">
              <label
                class="checkout-option"
                :class="{ 'checkout-option--active': selectedMethod === 'campus_balance' }"
              >
                <input
                  v-model="selectedMethod"
                  type="radio"
                  name="fakeMethod"
                  value="campus_balance"
                />
                <span class="checkout-option__icon">🎓</span>
                <div class="checkout-option__details">
                  <strong>Saldo demo campus UJAP</strong>
                  <span>Saldo virtual disponible: {{ currency }} 150.00</span>
                </div>
                <span class="checkout-tag">Recomendado</span>
              </label>

              <label
                class="checkout-option"
                :class="{ 'checkout-option--active': selectedMethod === 'fake_card' }"
              >
                <input
                  v-model="selectedMethod"
                  type="radio"
                  name="fakeMethod"
                  value="fake_card"
                />
                <span class="checkout-option__icon">💳</span>
                <div class="checkout-option__details">
                  <strong>Tarjeta académica demo (4242)</strong>
                  <span>•••• •••• •••• 4242 · Exp 12/28 · Estudiante UJAP</span>
                </div>
              </label>

              <label
                class="checkout-option"
                :class="{ 'checkout-option--active': selectedMethod === 'fake_mobile_pay' }"
              >
                <input
                  v-model="selectedMethod"
                  type="radio"
                  name="fakeMethod"
                  value="fake_mobile_pay"
                />
                <span class="checkout-option__icon">📱</span>
                <div class="checkout-option__details">
                  <strong>Pago Móvil simulado</strong>
                  <span>0412-0000000 · V-00000000 · Banco Demo</span>
                </div>
              </label>
            </div>
          </fieldset>

          <!-- Simulation Outcome Picker (Allows testing safe failure state) -->
          <fieldset class="checkout-fieldset checkout-fieldset--outcomes">
            <legend class="checkout-legend">Simular resultado de pasarela</legend>
            <div class="checkout-outcome-grid">
              <label
                class="checkout-outcome-card"
                :class="{ 'checkout-outcome-card--active': selectedOutcome === 'success' }"
              >
                <input
                  v-model="selectedOutcome"
                  type="radio"
                  name="simulationOutcome"
                  value="success"
                />
                <div class="checkout-outcome-card__body">
                  <span class="checkout-outcome-card__badge checkout-outcome-card__badge--success">✓ Éxito</span>
                  <strong>Aprobar pago simulado</strong>
                  <p>Registra el pago con estado SIMULATED_PAID y habilita la aprobación del dueño.</p>
                </div>
              </label>

              <label
                class="checkout-outcome-card"
                :class="{ 'checkout-outcome-card--active': selectedOutcome === 'failure' }"
              >
                <input
                  v-model="selectedOutcome"
                  type="radio"
                  name="simulationOutcome"
                  value="failure"
                />
                <div class="checkout-outcome-card__body">
                  <span class="checkout-outcome-card__badge checkout-outcome-card__badge--fail">⚠ Fallo seguro</span>
                  <strong>Simular error / rechazo</strong>
                  <p>Simula fondos demo insuficientes o rechazo temporal sin cancelar la solicitud.</p>
                </div>
              </label>
            </div>
          </fieldset>

          <!-- Actions -->
          <footer class="checkout-actions">
            <button
              class="btn btn--ghost"
              type="button"
              @click="$emit('close')"
            >
              Cancelar y volver
            </button>
            <button
              class="btn btn--primary"
              type="button"
              @click="processCheckout"
            >
              {{ selectedOutcome === 'success' ? 'Confirmar pago simulado' : 'Ejecutar simulación con error' }}
            </button>
          </footer>
        </div>

        <!-- Processing State -->
        <div v-else-if="viewMode === 'processing'" class="checkout-state" aria-live="polite">
          <LoadingState label="Procesando pago simulado en entorno de pruebas…" />
          <p class="checkout-state__hint">
            Validando autorización de la solicitud y registrando referencia demo…
          </p>
        </div>

        <!-- Success State -->
        <div v-else-if="viewMode === 'success'" class="checkout-state checkout-state--success" aria-live="polite">
          <div class="checkout-state__symbol" aria-hidden="true">✓</div>
          <h3>¡Pago simulado registrado con éxito!</h3>
          <p class="checkout-state__desc">
            Se ha registrado el monto de <strong>{{ formattedTotal }}</strong> en modo de prueba.
            Tu solicitud para <em>{{ itemTitle }}</em> ahora está lista para ser aprobada por su propietario.
          </p>

          <div v-if="paymentResult?.providerReference" class="checkout-receipt">
            <span class="checkout-receipt__label">Referencia de simulación:</span>
            <code class="checkout-receipt__code">{{ paymentResult.providerReference }}</code>
          </div>

          <footer class="checkout-actions checkout-actions--center">
            <button class="btn btn--primary" type="button" @click="finish">
              Ver en mis solicitudes
            </button>
          </footer>
        </div>

        <!-- Failure State (Safe Failure Mode) -->
        <div v-else-if="viewMode === 'failure'" class="checkout-state checkout-state--failure" aria-live="polite">
          <div class="checkout-state__symbol checkout-state__symbol--fail" aria-hidden="true">⚠</div>
          <h3>Simulación: Pago no completado</h3>
          <p class="checkout-state__desc">
            {{ failureReason }}
          </p>

          <div class="checkout-failure-box">
            <strong>Estado seguro de la solicitud:</strong>
            <p>
              Tu solicitud no ha sido cancelada. Permanece en tu bandeja con estado <code>PENDIENTE</code> y
              pago marcado como <code>FALLIDO</code>. Puedes reintentar la simulación cuando desees.
            </p>
          </div>

          <footer class="checkout-actions checkout-actions--center">
            <button class="btn btn--ghost" type="button" @click="finish">
              Volver a solicitudes
            </button>
            <button class="btn btn--primary" type="button" @click="retryCheckout">
              Reintentar simulación
            </button>
          </footer>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.checkout-backdrop {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: color-mix(in srgb, var(--navy) 65%, transparent);
  backdrop-filter: blur(5px);
  overflow-y: auto;
}

.checkout-dialog {
  position: relative;
  width: min(100%, 580px);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-radius: 20px;
  background: var(--paper-2);
  border: 1px solid var(--line-strong);
  box-shadow: var(--shadow);
  padding: 24px;
  outline: none;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

@media (max-width: 600px) {
  .checkout-dialog {
    padding: 18px;
    max-height: 95vh;
  }
}

.checkout-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 20px;
}

.checkout-header__title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkout-badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 2px 10px;
  border-radius: 999px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--gold-bg);
  color: var(--gold);
  border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent);
}

.checkout-header h2 {
  font-size: 24px;
  line-height: 1.2;
  color: var(--ink);
}

.checkout-close {
  background: transparent;
  border: none;
  font-size: 26px;
  line-height: 1;
  color: var(--ink-faint);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  transition: color 0.15s ease, background 0.15s ease;
}

.checkout-close:hover {
  color: var(--crimson);
  background: var(--crimson-bg);
}

.checkout-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Item & pricing summary */
.checkout-summary {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
  background: var(--paper);
  border: 1px solid var(--line);
}

.checkout-summary__item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.checkout-summary__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--crimson-bg);
  font-size: 22px;
  flex-shrink: 0;
}

.checkout-summary__meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.checkout-summary__code {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-faint);
  letter-spacing: 0.04em;
}

.checkout-summary__meta strong {
  font-family: var(--display);
  font-size: 18px;
  color: var(--ink);
  line-height: 1.25;
}

.checkout-summary__meta span {
  font-size: 13.5px;
  color: var(--ink-soft);
}

.checkout-summary__date {
  font-size: 12.5px !important;
  color: var(--navy) !important;
  font-weight: 500;
}

.checkout-pricing {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.checkout-pricing__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--ink-soft);
}

.checkout-pricing__row--free strong {
  color: #1b7340;
  font-size: 13px;
}

.checkout-pricing__row--total {
  padding-top: 6px;
  border-top: 1px solid var(--line);
  font-size: 15.5px;
  font-weight: 600;
  color: var(--ink);
}

.checkout-pricing__amount {
  font-family: var(--display);
  font-size: 20px;
  color: var(--crimson);
}

/* Notice */
.checkout-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--navy-bg);
  border: 1px solid color-mix(in srgb, var(--navy) 20%, transparent);
}

.checkout-notice__icon {
  font-size: 18px;
  line-height: 1.2;
  color: var(--navy);
  font-weight: 700;
}

.checkout-notice__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkout-notice__content strong {
  font-size: 13.5px;
  color: var(--navy);
}

.checkout-notice__content p {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ink-soft);
}

.checkout-notice__content code {
  font-family: var(--mono);
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--paper);
}

/* Fieldset */
.checkout-fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkout-legend {
  font-size: 13.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-faint);
  margin-bottom: 6px;
}

.checkout-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkout-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--paper);
  border: 1.5px solid var(--line);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.checkout-option:hover {
  border-color: var(--line-strong);
}

.checkout-option--active {
  border-color: var(--crimson);
  background: color-mix(in srgb, var(--crimson-bg) 25%, var(--paper));
}

.checkout-option input[type='radio'] {
  accent-color: var(--crimson);
  width: 17px;
  height: 17px;
  cursor: pointer;
}

.checkout-option__icon {
  font-size: 20px;
  flex-shrink: 0;
}

.checkout-option__details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.checkout-option__details strong {
  font-size: 14.5px;
  color: var(--ink);
}

.checkout-option__details span {
  font-size: 12px;
  color: var(--ink-soft);
}

.checkout-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--gold-bg);
  color: var(--gold);
}

/* Outcomes grid */
.checkout-outcome-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 520px) {
  .checkout-outcome-grid {
    grid-template-columns: 1fr;
  }
}

.checkout-outcome-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: var(--paper);
  border: 1.5px solid var(--line);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.checkout-outcome-card:hover {
  border-color: var(--line-strong);
}

.checkout-outcome-card--active {
  border-color: var(--navy);
  background: color-mix(in srgb, var(--navy-bg) 30%, var(--paper));
}

.checkout-outcome-card input[type='radio'] {
  accent-color: var(--navy);
  margin-top: 3px;
  cursor: pointer;
}

.checkout-outcome-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkout-outcome-card__badge {
  display: inline-block;
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
}

.checkout-outcome-card__badge--success {
  background: rgba(27, 115, 64, 0.12);
  color: #1b7340;
}

.checkout-outcome-card__badge--fail {
  background: rgba(200, 16, 46, 0.12);
  color: var(--crimson);
}

.checkout-outcome-card__body strong {
  font-size: 13.5px;
  color: var(--ink);
}

.checkout-outcome-card__body p {
  font-size: 11.5px;
  color: var(--ink-soft);
  line-height: 1.35;
}

/* Actions */
.checkout-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.checkout-actions--center {
  justify-content: center;
  border-top: none;
  padding-top: 12px;
}

@media (max-width: 480px) {
  .checkout-actions {
    flex-direction: column-reverse;
  }
  .checkout-actions .btn {
    width: 100%;
  }
}

/* State Views: Processing, Success, Failure */
.checkout-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 30px 16px;
}

.checkout-state__hint {
  font-size: 13px;
  color: var(--ink-faint);
}

.checkout-state__symbol {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(27, 115, 64, 0.14);
  color: #1b7340;
  font-size: 32px;
  font-weight: 700;
}

.checkout-state__symbol--fail {
  background: var(--crimson-bg);
  color: var(--crimson);
}

.checkout-state h3 {
  font-size: 22px;
  color: var(--ink);
}

.checkout-state__desc {
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--ink-soft);
  max-width: 440px;
}

.checkout-receipt {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 18px;
  border-radius: 10px;
  background: var(--paper);
  border: 1px solid var(--line);
}

.checkout-receipt__label {
  font-size: 11.5px;
  color: var(--ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.checkout-receipt__code {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--navy);
}

.checkout-failure-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 12px;
  background: var(--paper);
  border: 1px solid var(--line-strong);
  text-align: left;
  max-width: 440px;
}

.checkout-failure-box strong {
  font-size: 13px;
  color: var(--ink);
}

.checkout-failure-box p {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ink-soft);
}

.checkout-failure-box code {
  font-family: var(--mono);
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--paper-2);
}
</style>
