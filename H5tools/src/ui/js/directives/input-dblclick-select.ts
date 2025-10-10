const handler = e => {
  try {
    e.target.select();
  } catch (e) {}
};

const inputDblckckSelect = {
  mounted(el) {
    el.addEventListener('dblclick', handler);
  },
  unmounted(el) {
    el.removeEventListener('dblclick', handler);
  },
};

export default inputDblckckSelect;
