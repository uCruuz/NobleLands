<template>
  <input
    class="tw-input"
    :type="type"
    :value="modelValue"
    :style="{ width: width }"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>

<script setup>
defineProps({
  type: {
   type: String,
    default: 'text' 
  },
  modelValue: { 
   type: String,
   default: '' 
  },
  width: { type: String, default: '100%' }
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.tw-input {
  width: 100%;
  box-sizing: border-box;
  
  background: none;
  border: 3px solid transparent;
  border-image: url('/border_input.jpg') 3 fill stretch;
  
  padding: 4px 6px;
  font-size: 12px;
  color: #333;
  outline: none;
}
.tw-input:focus {
  box-shadow: 0 0 3px rgba(90,58,26,0.3);
}
</style>
