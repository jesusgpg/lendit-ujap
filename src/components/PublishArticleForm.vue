<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { push } from 'notivue'
import { useArticlesStore } from '../stores/articles'
import { useCatalogStore } from '../stores/catalog'
import { removeItemPhoto, uploadItemPhoto } from '../lib/storage'
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
const photoPreview = ref(props.article?.photoUrl ?? '')
const photoRemoved = ref(false)
const errorMessage = ref('')
const { defineField, errors, handleSubmit, isSubmitting, setFieldValue } = useForm({
  initialValues: {
    title: props.article?.title ?? '',
    categoryKey: props.article?.categoryKey ?? '',
    duration: props.article?.duration ?? '',
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
const [duration, durationAttrs] = defineField('duration')
const [description, descriptionAttrs] = defineField('description')
const [price, priceAttrs] = defineField('price')
const [currency, currencyAttrs] = defineField('currency')

onMounted(async () => {
  await catalog.initialize()
  if (!categoryKey.value) {
    setFieldValue('categoryKey', catalog.categories[0]?.key ?? '')
  }
})

function handlePhotoUpdate(dataUrl: string) {
  photoPreview.value = dataUrl
  photoRemoved.value = false
  errorMessage.value = ''
}

function clearPhoto() {
  photoPreview.value = ''
  photoRemoved.value = true
}

const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''
  const selectedMode = publicationMode.value
  const selectedCurrency = currency.value as Currency
  const selectedPrice = selectedMode === 'RENTAL' ? Number(price.value) : undefined
  let uploadedPhotoUrl: string | null = null

  try {
    if (photoPreview.value && photoPreview.value !== props.article?.photoUrl) {
      uploadedPhotoUrl = await uploadItemPhoto(photoPreview.value)
    }

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
      }
      if (photoRemoved.value) {
        input.photoUrl = null
      } else if (uploadedPhotoUrl) {
        input.photoUrl = uploadedPhotoUrl
      }

      await articlesStore.update(props.article.id, input)
      if ((uploadedPhotoUrl || photoRemoved.value) && props.article.photoUrl) {
        void removeItemPhoto(props.article.photoUrl).catch(() => undefined)
      }
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
      }
      if (uploadedPhotoUrl) input.photoUrl = uploadedPhotoUrl
      await articlesStore.publish(input)
      emit('published')
    }

    if (!props.article) {
      setFieldValue('title', '')
      setFieldValue('duration', '')
      setFieldValue('description', '')
      setFieldValue('price', '')
      setFieldValue('currency', 'USD')
      restrictedToRoles.value = []
      publicationMode.value = 'LOAN'
      photoPreview.value = ''
    }
  } catch (error) {
    if (uploadedPhotoUrl) {
      await removeItemPhoto(uploadedPhotoUrl).catch(() => undefined)
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

    <label class="field">
      <span>Tiempo de préstamo</span>
      <input v-model="duration" v-bind="durationAttrs" type="text" placeholder="Ej: 4 horas, 2 días" required />
      <span v-if="errors.duration" class="field__error">{{ errors.duration }}</span>
    </label>

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
          <small>Usa un pago simulado por ahora.</small>
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
      <span>Foto del objeto <small>(opcional)</small></span>
      <PhotoDropzone
        :model-value="photoPreview"
        alt="Foto del objeto"
        hint="JPG o PNG, hasta 5 MB. Se optimiza automáticamente."
        @update:model-value="handlePhotoUpdate"
      />
      <button v-if="photoPreview" type="button" class="photo-remove" @click="clearPhoto">Quitar foto</button>
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
