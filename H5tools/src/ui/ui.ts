import './styles/reset.css';
import './styles/common.less';
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
  Row,
  Col,
  Field,
  Divider,
  DropdownMenu,
  DropdownItem,
  Cell,
  CellGroup,
  Stepper,
  Empty
} from 'vant';
import { createPinia } from 'pinia';
import inputDblckckSelect from './js/directives/input-dblclick-select'

const app = createApp(App);
app.use(Icon);
app.use(Tabs);
app.use(Tab);
app.use(Popup);
app.use(Button);
app.use(Checkbox);
app.use(Row);
app.use(Col);
app.use(Field);
app.use(Divider);
app.use(DropdownMenu);
app.use(DropdownItem);
app.use(Cell);
app.use(CellGroup);
app.use(Stepper);
app.use(Empty);
app.use(createPinia());
app.directive('input-dblclick-select', inputDblckckSelect);


setTimeout(() => {
  app.mount('#app');
}, 0);
