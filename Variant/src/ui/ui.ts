import './styles/index.css';
import 'vant/lib/index.css';

import { createApp } from 'vue';
import App from './App.vue';
import {
  Icon,
  Tabs,
  Tab,
  Popup,
  Button,
  Checkbox,
  CheckboxGroup,
  Search,
  Loading,
  Field
} from 'vant';
import { createPinia } from 'pinia';
import inputDblclickSelect from './directives/input-dblclick-select';
import { applyTheme, getSystemTheme } from './utils/theme';

// 首帧按系统主题渲染，避免闪烁；随后 App.vue 会用「已记住的主题」覆盖
applyTheme(getSystemTheme());

const app = createApp(App);
app.use(Icon);
app.use(Tabs);
app.use(Tab);
app.use(Popup);
app.use(Button);
app.use(Checkbox);
app.use(CheckboxGroup);
app.use(Search);
app.use(Loading);
app.use(Field);
app.use(createPinia());
app.directive('input-dblclick-select', inputDblclickSelect);


setTimeout(() => {
  app.mount('#app');
}, 0);
