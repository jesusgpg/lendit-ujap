<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { push } from 'notivue'
import { useArticlesStore } from '../stores/articles'
import { useCatalogStore } from '../stores/catalog'
import { removeItemPhotos, uploadItemPhoto } from '../lib/storage'
import type { Article, Currency, ItemMode, NewArticleInput, UpdateArticleInput } from '../types'
import PhotoDropzone from './PhotoDropzone.vue'

const props = withDefaults(
  defineProps<{
    article?: Article
    submitLabel?: string
  }>(),
  { submitLabel: 'Publicar objeto' },
)

const emit = defineEmits<{
  (e: 'published'): void
  (e: 'updated'): void
}>()

const articlesStore = useArticlesStore()
const catalog = useCatalogStore()

// Audiencia: vacío = visible para todos. 'STUDENT' / 'PROFESSOR' restringe quién puede pedirlo.
const restrictedToRoles = ref<string[]>(props.article?.restrictedToRoles ?? [])
const publicationMode = ref<ItemMode>(props.article?.mode ?? 'LOAN')

type DurationUnit = 'hours' | 'days' | 'weeks' | 'custom'

function parseDuration(value: string): { amount: number; unit: DurationUnit; custom: string } {
  const trimmed = value.trim()
  if (!trimmed) return { amount: 1, unit: 'days', custom: '' }

  const normalized = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const match = normalized.match(/^(\d+)\s*(h|hora|horas|d|dia|dias|sem|semana|semanas)$/)
  if (!match) return { amount: 1, unit: 'custom', custom: trimmed }

  const amount = Number(match[1])
  if (amount < 1) return { amount: 1, unit: 'custom', custom: trimmed }

  const unit: DurationUnit = match[2].startsWith('h')
    ? 'hours'
    : match[2].startsWith('d')
      ? 'days'
      : 'weeks'
  return { amount, unit, custom: '' }
}

function formatDuration(amount: number, unit: Exclude<DurationUnit, 'custom'>) {
  const singular = amount === 1
  if (unit === 'hours') return `${amount} ${singular ? 'hora' : 'horas'}`
  if (unit === 'days') return `${amount} ${singular ? 'día' : 'días'}`
  return `${amount} ${singular ? 'semana' : 'semanas'}`
}

const initialDuration = parseDuration(props.article?.duration ?? '')
const durationAmount = ref<number | ''>(initialDuration.amount)
const durationUnit = ref<DurationUnit>(initialDuration.unit)
const customDuration = ref(initialDuration.custom)
const durationPreview = computed(() => {
  if (durationUnit.value === 'custom') return customDuration.value.trim()
  const amount = Number(durationAmount.value)
  if (!Number.isInteger(amount) || amount < 1) return ''
  return formatDuration(amount, durationUnit.value)
})

function getInitialPhotos(): string[] {
  if (props.article?.photoUrls && props.article.photoUrls.length > 0) {
    return [...props.article.photoUrls]
  }
  return props.article?.photoUrl ? [props.article.photoUrl] : []
}

const photos = ref<string[]>(getInitialPhotos())
const originalPhotos = ref<string[]>(getInitialPhotos())
const errorMessage = ref('')
const { defineField, errors, handleSubmit, isSubmitting, setFieldValue } = useForm({
  initialValues: {
    title: props.article?.title ?? '',
    categoryKey: props.article?.categoryKey ?? '',
    duration: initialDuration.unit === 'custom'
      ? initialDuration.custom
      : formatDuration(initialDuration.amount, initialDuration.unit),
    description: props.article?.description ?? '',
    price: props.article?.price?.toString() ?? '',
    currency: props.article?.currency ?? ('USD' as Currency),
  },
  validationSchema: {
    title: (value: string) => value.trim().length >= 3 || 'Escribe un nombre de al menos 3 caracteres.',
    categoryKey: (value: string) => !!value || 'Selecciona una categoría.',
    duration: (value: string) => value.trim().length >= 2 || 'Indica el tiempo de préstamo.',
    description: (value: string) => value.trim().length <= 1000 || 'La descripción es demasiado larga.',
    price: (value: string) => publicationMode.value !== 'RENTAL' || Number(value) > 0 || 'Indica un precio mayor que cero.',
    currency: (value: string) => publicationMode.value !== 'RENTAL' || !!value || 'Selecciona una moneda.',
  },
})
const [title, titleAttrs] = defineField('title')
const [categoryKey, categoryKeyAttrs] = defineField('categoryKey')
const [description, descriptionAttrs] = defineField('description')
const [price, priceAttrs] = defineField('price')
const [currency, currencyAttrs] = defineField('currency')

watch([durationAmount, durationUnit, customDuration], () => {
  setFieldValue('duration', durationPreview.value)
}, { flush: 'sync' })

onMounted(async () => {
  await catalog.initialize()
  if (!categoryKey.value) {
    setFieldValue('categoryKey', catalog.categories[0]?.key ?? '')
  }
})

function handlePhotosUpdate(val: string | string[]) {
  photos.value = Array.isArray(val) ? val : (val ? [val] : [])
  errorMessage.value = ''
}

function clearAllPhotos() {
  photos.value = []
}

const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''
  const selectedMode = publicationMode.value
  const selectedCurrency = currency.value as Currency
  const selectedPrice = selectedMode === 'RENTAL' ? Number(price.value) : undefined
  const newlyUploadedUrls: string[] = []

  try {
    const finalUploadedUrls: string[] = []

    for (const photo of photos.value) {
      if (photo.startsWith('data:')) {
        const uploaded = await uploadItemPhoto(photo)
        newlyUploadedUrls.push(uploaded)
        finalUploadedUrls.push(uploaded)
      } else {
        finalUploadedUrls.push(photo)
      }
    }

    const coverPhotoUrl = finalUploadedUrls[0] ?? null

    if (props.article) {
      const input: UpdateArticleInput = {
        title: values.title.trim(),
        categoryKey: values.categoryKey,
        duration: values.duration.trim(),
        description: values.description.trim(),
        mode: selectedMode,
        price: selectedPrice,
        currency: selectedMode === 'RENTAL' ? selectedCurrency : undefined,
        restrictedToRoles: restrictedToRoles.value,
        photoUrl: coverPhotoUrl,
        photoUrls: finalUploadedUrls,
      }

      await articlesStore.update(props.article.id, input)

      // Clean up removed original photos from Supabase storage
      const removedPhotos = originalPhotos.value.filter((url) => !finalUploadedUrls.includes(url))
      if (removedPhotos.length > 0) {
        void removeItemPhotos(removedPhotos).catch(() => undefined)
      }

      originalPhotos.value = [...finalUploadedUrls]
      emit('updated')
    } else {
      const input: NewArticleInput = {
        title: values.title.trim(),
        categoryKey: values.categoryKey,
        duration: values.duration.trim(),
        description: values.description.trim() || undefined,
        mode: selectedMode,
        price: selectedPrice,
        currency: selectedMode === 'RENTAL' ? selectedCurrency : undefined,
        restrictedToRoles: restrictedToRoles.value,
        photoUrl: coverPhotoUrl ?? undefined,
        photoUrls: finalUploadedUrls,
      }

      await articlesStore.publish(input)
      emit('published')
    }

    if (!props.article) {
      setFieldValue('title', '')
      durationAmount.value = 1
      durationUnit.value = 'days'
      customDuration.value = ''
      setFieldValue('duration', '1 día')
      setFieldValue('description', '')
      setFieldValue('price', '')
      setFieldValue('currency', 'USD')
      restrictedToRoles.value = []
      publicationMode.value = 'LOAN'
      photos.value = []
      originalPhotos.value = []
    }
  } catch (error) {
    if (newlyUploadedUrls.length > 0) {
      await removeItemPhotos(newlyUploadedUrls).catch(() => undefined)
    }
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo guardar el objeto.'
    push.error({
      title: props.article ? 'No se actualizó el objeto' : 'No se publicó el objeto',
      message: errorMessage.value,
    })
  }
})
</script>

<template>
  <form class="publish-form" novalidate @submit="onSubmit">
    <p class="publish-form__hint">Cuéntale al campus qué tienes disponible. Se publica de inmediato al guardar.</p>

    <label class="field">
      <span>Nombre del objeto</span>
      <input v-model="title" v-bind="titleAttrs" type="text" placeholder="Ej: Calculadora HP 50g" required />
      <span v-if="errors.title" class="field__error">{{ errors.title }}</span>
    </label>

    <label class="field">
      <span>Categoría</span>
      <select v-model="categoryKey" v-bind="categoryKeyAttrs" required>
        <option v-for="cat in catalog.categories" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
      </select>
      <span v-if="errors.categoryKey" class="field__error">{{ errors.categoryKey }}</span>
    </label>

    <div class="field field--duration" role="group" aria-labelledby="duration-label">
      <span id="duration-label">{{ publicationMode === 'LOAN' ? 'Tiempo de préstamo' : 'Duración del alquiler' }}</span>
      <div class="duration-control" :class="{ 'duration-control--invalid': errors.duration }">
        <input
          v-if="durationUnit !== 'custom'"
          id="duration-amount"
          v-model.number="durationAmount"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          aria-label="Cantidad de tiempo"
          :aria-invalid="Boolean(errors.duration)"
          :aria-describedby="errors.duration ? 'duration-error' : 'duration-preview'"
          required
        />
        <input
          v-else
          id="duration-custom"
          v-model="customDuration"
          type="text"
          maxlength="80"
          placeholder="Escribe el plazo acordado"
          aria-label="Duración personalizada"
          :aria-invalid="Boolean(errors.duration)"
          :aria-describedby="errors.duration ? 'duration-error' : 'duration-preview'"
          required
        />
        <select
          id="duration-unit"
          v-model="durationUnit"
          aria-label="Unidad de tiempo"
          :aria-invalid="Boolean(errors.duration)"
          :aria-describedby="errors.duration ? 'duration-error' : 'duration-preview'"
          required
        >
          <option value="hours">Horas</option>
          <option value="days">Días</option>
          <option value="weeks">Semanas</option>
          <option value="custom">Otro plazo</option>
        </select>
      </div>
      <small id="duration-preview" class="duration-preview" aria-live="polite">
        {{ durationPreview ? `Se mostrará como «${durationPreview}».` : 'Indica una cantidad entera desde 1.' }}
      </small>
      <span v-if="errors.duration" id="duration-error" class="field__error">{{ errors.duration }}</span>
    </div>

    <label class="field">
      <span>Descripción <small>(opcional)</small></span>
      <textarea
        v-model="description"
        v-bind="descriptionAttrs"
        rows="4"
        maxlength="1000"
        placeholder="Cuenta qué incluye, en qué estado está y dónde se puede retirar."
      ></textarea>
      <span v-if="errors.description" class="field__error">{{ errors.description }}</span>
    </label>

    <fieldset class="field field--mode">
      <legend>Modalidad</legend>
      <label class="mode-option" :class="{ 'mode-option--selected': publicationMode === 'LOAN' }">
        <input v-model="publicationMode" type="radio" value="LOAN" />
        <span>
          <strong>Préstamo gratuito</strong>
          <small>Se devuelve en el plazo acordado.</small>
        </span>
      </label>
      <label class="mode-option" :class="{ 'mode-option--selected': publicationMode === 'RENTAL' }">
        <input v-model="publicationMode" type="radio" value="RENTAL" />
        <span>
          <strong>Alquiler</strong>
          <small>El precio se cobra por cada solicitud.</small>
        </span>
      </label>
    </fieldset>

    <div v-if="publicationMode === 'RENTAL'" class="field-row">
      <label class="field">
        <span>Precio por solicitud</span>
        <input v-model="price" v-bind="priceAttrs" type="number" min="0.01" step="0.01" placeholder="5.00" />
        <span v-if="errors.price" class="field__error">{{ errors.price }}</span>
      </label>
      <label class="field">
        <span>Moneda</span>
        <select v-model="currency" v-bind="currencyAttrs">
          <option value="USD">USD · Dólares</option>
          <option value="EUR">EUR · Euros</option>
          <option value="VES">VES · Bolívares</option>
        </select>
        <span v-if="errors.currency" class="field__error">{{ errors.currency }}</span>
      </label>
    </div>

    <div class="field field--photo">
      <span>Fotos del objeto <small>(hasta 8 fotos · la primera será la portada)</small></span>
      <PhotoDropzone
        :model-value="photos"
        multiple
        :max-files="8"
        alt="Foto del objeto"
        hint="JPG o PNG, hasta 5 MB por foto."
        @update:model-value="handlePhotosUpdate"
      />
      <button v-if="photos.length > 0" type="button" class="photo-remove" @click="clearAllPhotos">
        Quitar todas las fotos
      </button>
    </div>

    <fieldset class="field field--audience">
      <legend>¿Quién puede pedirlo?</legend>
      <label class="field__checkbox">
        <input v-model="restrictedToRoles" type="checkbox" value="STUDENT" />
        <span>Solo estudiantes</span>
      </label>
      <label class="field__checkbox">
        <input v-model="restrictedToRoles" type="checkbox" value="PROFESSOR" />
        <span>Solo profesores</span>
      </label>
      <p class="field__hint">Deja ambas sin marcar para que lo vea todo el campus.</p>
    </fieldset>

    <p v-if="errorMessage" class="publish-form__error">{{ errorMessage }}</p>

    <button class="btn btn--primary publish-form__submit" type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Guardando…' : submitLabel }}
    </button>
  </form>
</template>

<style scoped>
.publish-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.publish-form__hint {
  font-size: 14px;
  color: var(--ink-faint);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.field input,
.field select,
.field textarea {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.field textarea {
  resize: vertical;
  min-height: 96px;
  line-height: 1.45;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--crimson);
}

.duration-control {
  display: grid;
  grid-template-columns: minmax(74px, 0.4fr) minmax(0, 1fr);
  min-height: 48px;
  border: 1.5px solid var(--line-strong);
  border-radius: 10px;
  background: var(--paper);
  overflow: hidden;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.duration-control:focus-within {
  border-color: var(--crimson);
  box-shadow: 0 0 0 3px var(--crimson-bg);
}

.duration-control--invalid {
  border-color: var(--crimson-dark);
}

.duration-control input,
.duration-control select {
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: 10px 13px;
  border: 0;
  border-radius: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: 500 15px/1.4 var(--sans);
}

.duration-control select {
  border-left: 1px solid var(--line);
  font-weight: 600;
  cursor: pointer;
}

.duration-control input:focus,
.duration-control select:focus {
  box-shadow: none;
}

.duration-preview {
  color: var(--ink-faint);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.field--mode,
.field--audience {
  border: 1.5px solid var(--line-strong);
  border-radius: 10px;
  padding: 12px 14px;
  gap: 8px;
}

.field--mode legend,
.field--audience legend {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
  padding: 0 4px;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--ink);
  cursor: pointer;
}

.mode-option--selected {
  border-color: color-mix(in srgb, var(--gold) 55%, var(--line));
  background: var(--gold-bg);
}

.mode-option input[type='radio'],
.field__checkbox input[type='checkbox'] {
  width: 18px;
  height: 18px;
  margin: 1px 0 0;
  accent-color: var(--crimson);
  flex: 0 0 auto;
}

.mode-option span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-option strong {
  font-size: 13.5px;
}

.mode-option small,
.field small {
  color: var(--ink-faint);
  font-size: 11px;
  font-weight: 400;
}

.field--photo {
  gap: 8px;
}

.photo-remove {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--crimson-dark);
  font: 500 12px var(--sans);
  cursor: pointer;
}

.photo-remove:hover {
  text-decoration: underline;
}

.field__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}

.field__hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-faint);
  margin: 2px 0 0 0;
}

.field__error {
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 500;
}

.publish-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
}

.publish-form__submit {
  margin-top: 4px;
  width: 100%;
}

.publish-form__submit:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 420px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
