
<template>
  <button @click="getNewString">Hello, {{ mg }}</button>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { sendMsgToPlugin, UIMessage } from '@messages/sender'

const mg = ref('MasterGo')

function getNewString() {
  mg.value = mg.value === 'MasterGo' ? 'World' : 'MasterGo'
  sendMsgToPlugin({
    type: UIMessage.HELLO,
    data: 'hello'
  })
}
</script>
