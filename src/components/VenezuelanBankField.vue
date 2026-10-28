<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { VENEZUELAN_BANKS } from '../lib/venezuelaBanks'

const OTHER_BANK = '__other__'
const props = withDefaults(defineProps<{
  label: string
  modelValue: string
  required?: boolean
  autocomplete?: string
}>(), { required: true, autocomplete: 'organization' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const fieldId = useId()
const selectedBank = ref('')
const otherBank = ref('')

watch(() => props.modelValue, value => {
  if (VENEZUELAN_BANKS.includes(value as typeof VENEZUELAN_BANKS[number])) {
    selectedBank.value = value
    otherBank.value = ''
  } else if (value) {
    selectedBank.value = OTHER_BANK
    otherBank.value = value
  } else if (selectedBank.value !== OTHER_BANK) {
    selectedBank.value = ''
  }
}, { immediate: true })

function selectBank(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  selectedBank.value = value
  if (value === OTHER_BANK) {
    otherBank.value = ''
    emit('update:modelValue', '')
  } else {
    otherBank.value = ''
    emit('update:modelValue', value)
  }
}

function updateOtherBank(event: Event) {
  otherBank.value = (event.target as HTMLInputElement).value
  emit('update:modelValue', otherBank.value.trim())
}
</script>

<template>
  <div class="bank-field">
    <label :for="fieldId">{{ label }}</label>
    <select :id="fieldId" :value="selectedBank" :required="required && selectedBank !== OTHER_BANK" @change="selectBank">
      <option value="" disabled>Selecciona un banco</option>
      <option v-for="bank in VENEZUELAN_BANKS" :key="bank" :value="bank">{{ bank }}</option>
      <option :value="OTHER_BANK">Otro banco</option>
    </select>
    <label v-if="selectedBank === OTHER_BANK" :for="`${fieldId}-other`">Nombre del banco</label>
    <input
      v-if="selectedBank === OTHER_BANK"
      :id="`${fieldId}-other`"
      :value="otherBank"
      :required="required"
      maxlength="100"
      :autocomplete="autocomplete"
      placeholder="Escribe el nombre del banco"
      @input="updateOtherBank"
    />
  </div>
</template>

<style scoped>
.bank-field{display:grid;gap:7px;min-width:0;font-size:13px;font-weight:600;color:var(--ink)}
.bank-field :is(select,input){box-sizing:border-box;width:100%;min-height:45px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:9px;background:var(--paper);color:var(--ink);font:400 15px var(--sans)}
.bank-field :is(select,input):focus-visible{outline:2px solid var(--navy);outline-offset:3px}
</style>
