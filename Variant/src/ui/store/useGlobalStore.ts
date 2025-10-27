import { defineStore } from 'pinia';

export default defineStore('globalStore', {
  state: () => ({
    selection: [],
  }),
});
