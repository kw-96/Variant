require('./styles/reset.css');
require('./styles/common.less');

import { createApp } from 'vue';
import App from './App.vue';
import { Icon } from 'vant';
import { createPinia } from 'pinia';
import inputDblckckSelect from '@/ui/js/directives/input-dblclick-select'

const app = createApp(App);
app.use(Icon);
app.use(createPinia());
app.directive('input-dblclick-select', inputDblckckSelect);

setTimeout(() => app.mount('#app'), 0);
