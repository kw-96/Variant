<template>
  <div :class="$style.page">
    <iframe
      ref="frameRef"
      :class="$style.frame"
      :srcdoc="psdHtml"
      title="PSD转换"
      @load="sendTheme"
    ></iframe>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { MessageType, addMessageListener } from '../../../messages';
import psdHtml from './psd-ui.html?raw';

/**
 * PSD 转换页
 * 原独立插件 psd-2-mastergo 的界面整体放入 iframe 运行（解析、整理、导出逻辑与原版一致），
 * 这里只负责三件事：
 * 1) 把 iframe 发出的原始消息转发给主线程（PSD_TO_PLUGIN）；
 * 2) 把主线程回传的消息（PSD_TO_UI）原样投递给 iframe；
 * 3) 把宿主当前的明暗主题色同步给 iframe。
 */
const frameRef = ref<HTMLIFrameElement | null>(null);

const THEME_VARS: Record<string, string> = {
  '--host-bg': '--bg-primary',
  '--host-bg-secondary': '--bg-secondary',
  '--host-text': '--text-primary',
  '--host-text-secondary': '--text-secondary',
  '--host-border': '--border-color',
  '--host-input-bg': '--input-bg',
  '--host-primary': '--button-primary-bg',
  '--host-primary-text': '--button-primary-text'
};

function collectThemeVars(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const vars: Record<string, string> = {};
  Object.entries(THEME_VARS).forEach(([target, source]) => {
    const value = style.getPropertyValue(source).trim();
    if (value) vars[target] = value;
  });
  const font = getComputedStyle(document.body).fontFamily;
  if (font) vars['--host-font'] = font;
  return vars;
}

function sendTheme() {
  frameRef.value?.contentWindow?.postMessage({ type: 'psd-host-theme', vars: collectThemeVars() }, '*');
}

/** iframe -> 主线程 */
function onFrameMessage(event: MessageEvent) {
  const frameWindow = frameRef.value?.contentWindow;
  if (!frameWindow || event.source !== frameWindow) return;
  // 不让 iframe 的消息进入宿主自己的消息分发
  event.stopImmediatePropagation();
  const message = event.data;
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'psd-host-ready') {
    sendTheme();
    return;
  }
  parent.postMessage({ type: MessageType.PSD_TO_PLUGIN, data: message }, '*');
}

let removePluginListener: (() => void) | null = null;
let themeObserver: MutationObserver | null = null;

onMounted(() => {
  window.addEventListener('message', onFrameMessage, true);
  // 主线程 -> iframe
  removePluginListener = addMessageListener(MessageType.PSD_TO_UI, (data: any) => {
    frameRef.value?.contentWindow?.postMessage(data, '*');
  });
  themeObserver = new MutationObserver(sendTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onFrameMessage, true);
  removePluginListener?.();
  themeObserver?.disconnect();
});
</script>

<style lang="less" module>
.page {
  position: absolute;
  inset: 0;
  background: var(--bg-primary);
  overflow: hidden;
}

.frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--bg-primary);
}
</style>
