const handler = (e: Event) => {
  try {
    (e.target as HTMLInputElement)?.select();
  } catch (e) {
    // 忽略错误
  }
};

const inputDblckckSelect = {
  mounted(el: HTMLElement) {
    el.addEventListener('dblclick', handler);
  },
  unmounted(el: HTMLElement) {
    el.removeEventListener('dblclick', handler);
  },
};

export default inputDblckckSelect;
