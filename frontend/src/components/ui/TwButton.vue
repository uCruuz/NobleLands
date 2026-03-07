<template>
  <button class="tw-btn" :class="{ 'tw-btn--full': full }" @click="$emit('click')">
    <span class="btn-left"></span>
    <span class="btn-mid">
      <slot />
    </span>
    <span class="btn-right"></span>
  </button>
</template>

<script setup>
defineProps({
  full: {
    type: Boolean,
    default: false
  }
})
defineEmits(['click'])
</script>

<style scoped>
.tw-btn {
  display: inline-flex;
  align-items: stretch;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: 0;
}
.tw-btn--full {
  width: 100%;
}
.btn-left,
.btn-right {
  display: block;
  width: 7px;
  flex-shrink: 0;
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 100% 200%;
  align-self: stretch;
  min-height: 100%;
}
.btn-left  { background-image: url('/btn_left.jpg'); }
.btn-right { background-image: url('/btn_right.jpg'); }
.btn-mid {
  flex: 1;
  display: block;
  background-image: url('/btn_mid.jpg');
  background-repeat: repeat-x;
  background-position: 0 0;
  background-size: auto 200%;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  font-family: Verdana, Arial, sans-serif;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.6);
  padding: 8px 16px;
  text-align: center;
  line-height: 1;
}
.tw-btn:hover .btn-mid,
.tw-btn:active .btn-mid { background-position: 0 100%; }
.tw-btn:hover .btn-left,
.tw-btn:active .btn-left { background-position: 0 100%; }
.tw-btn:hover .btn-right,
.tw-btn:active .btn-right { background-position: 0 100%; }
</style>
