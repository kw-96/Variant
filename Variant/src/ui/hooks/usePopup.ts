import { shallowRef, ref, inject, provide } from 'vue';

const POPUP_KEY = Symbol('popup');

// 全局唯一实例
const createPopupInstance = () => {
  const isVisible = ref(false); // 弹窗显示状态
  const component = shallowRef(null); // 动态加载组件
  const props = ref({}); // 组件 props
  const listeners = ref({}); // 组件事件绑定

  const showPopup = (
    dynamicComponent,
    componentProps = {},
    eventListeners = {}
  ) => {
    component.value = dynamicComponent;
    props.value = componentProps;
    listeners.value = eventListeners;
    isVisible.value = true;
  };

  const hidePopup = () => {
    isVisible.value = false;
    component.value = null;
    props.value = {};
    listeners.value = {};
  };

  return {
    isVisible,
    component,
    props,
    listeners,
    showPopup,
    hidePopup,
  };
};

export const providePopup = () => {
  const instance = createPopupInstance();
  provide(POPUP_KEY, instance);
  return instance;
};

export const usePopup = () => {
  const instance = inject(POPUP_KEY);
  if (!instance) {
    throw new Error('usePopup must be used after providePopup');
  }
  return instance;
};
