<script setup lang="ts">
import { ref } from 'vue'
import { getItemCategories } from '../data'
import { useArticlesStore } from '../stores/articles'

const emit = defineEmits<{
  (e: 'published'): void
}>()

const articlesStore = useArticlesStore()
const categories = getItemCategories()

const title = ref('')
const category = ref(categories[0]?.id ?? '')
const duration = ref('')
const errorMessage = ref('')

function handleSubmit() {
  if (!title.value.trim() || !duration.value.trim()) {
    errorMessage.value = 'Completa el nombre del objeto y el tiempo de préstamo.'
    return
  }

  const categoryLabel = categories.find((c) => c.id === category.value)?.label ?? category.value
  articlesStore.publish({
    title: title.value.trim(),
    category: categoryLabel,
    duration: duration.value.trim(),
  })

  errorMessage.value = ''
  title.value = ''
  duration.value = ''
  emit('published')
}
</script>

<template>
  <form class="publish-form" @submit.prevent="handleSubmit">
    <p class="publish-form__hint">Cuéntale al campus qué tienes disponible para prestar.</p>

    <label class="field">
      <span>Nombre del objeto</span>
      <input v-model="title" type="text" placeholder="Ej: Calculadora HP 50g" required />
    </label>

    <label class="field">
      <span>Categoría</span>
      <select v-model="category" required>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.label }}</option>
      </select>
    </label>

    <label class="field">
      <span>Tiempo de préstamo</span>
      <input v-model="duration" type="text" placeholder="Ej: 4 horas, 2 días" required />
    </label>

    <p v-if="errorMessage" class="publish-form__error">{{ errorMessage }}</p>

    <button class="btn btn--primary publish-form__submit" type="submit">Publicar objeto</button>
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
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.field input,
.field select {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--crimson);
}

.publish-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
}

.publish-form__submit {
  margin-top: 4px;
  width: 100%;
}
</style>
