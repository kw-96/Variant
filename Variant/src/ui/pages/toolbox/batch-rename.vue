<template>
  <div :class="$style.container">
    <!-- 标题栏 -->
    <div :class="$style.header">
      <button :class="$style.backButton" @click="handleBack" title="返回">
        <van-icon name="arrow-left" :class="$style.backIcon" />
      </button>
      <div :class="$style.title">批量命名</div>
    </div>
    <!-- 标签切换 -->
    <div :class="$style.tabs">
      <div
        :class="[$style.tab, { [$style.active]: activeTab === 'fixed' }]"
        @click="activeTab = 'fixed'"
      >
        固定文本
      </div>
      <div
        :class="[$style.tab, { [$style.active]: activeTab === 'auto' }]"
        @click="activeTab = 'auto'"
      >
        自动序号
      </div>
    </div>
    <!-- 页面内容 -->
    <div :class="$style.content">

      <!-- 位置选择按钮 -->
      <div :class="$style.positionButtons">
        <van-button
          :type="position === 'before' ? 'primary' : 'default'"
          :class="$style.positionButton"
          @click="position = 'before'"
        >
          在名称前
        </van-button>
        <van-button
          :type="position === 'after' ? 'primary' : 'default'"
          :class="$style.positionButton"
          @click="position = 'after'"
        >
          在名称后
        </van-button>
      </div>

      <!-- 固定文本标签页内容 -->
      <div v-if="activeTab === 'fixed'" :class="$style.tabContent">
        <TabInput
          v-model="fixedText"
          placeholder="请输入要插入的文本"
        />
      </div>

      <!-- 自动序号标签页内容 -->
      <div v-else :class="$style.tabContent">
        <div :class="$style.tip">
          注意：序号按图层面板顺序由下往上进行排序
        </div>
        <div :class="$style.autoNumberSection">
          <div :class="$style.selectWrapper">
            <label :class="$style.label">序号类型</label>
            <select
              v-model="numberType"
              :class="$style.typeSelect"
              @change="handleNumberTypeChange"
            >
              <option value="arabic">阿拉伯数字</option>
              <option value="chinese-lower">中文小写数字</option>
              <option value="chinese-upper">中文大写数字</option>
              <option value="english-lower">英文小写字母</option>
              <option value="english-upper">英文大写字母</option>
            </select>
          </div>

          <div :class="$style.inputWrapper">
            <label :class="$style.label">开始序号</label>
            <TabInput
              v-model="startNumberInput"
              :placeholder="getDefaultStartNumber()"
              @input="handleStartNumberInput"
              @blur="validateStartNumber"
            />
            <div v-if="startNumberError" :class="$style.errorText">
              {{ startNumberError }}
            </div>
          </div>
        </div>
      </div>

      <!-- 开始重命名按钮 -->
      <van-button
        block
        type="primary"
        :class="$style.renameButton"
        @click="handleRename"
        :disabled="!canRename"
      >
        开始重命名
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import TabInput from '../../components/TabInput.vue';

// 定义事件
const emit = defineEmits<{
  back: [];
}>();

// 标签状态
const activeTab = ref<'fixed' | 'auto'>('fixed');

// 位置选择
const position = ref<'before' | 'after'>('before');

// 固定文本
const fixedText = ref('');

// 自动序号相关
const numberType = ref<'arabic' | 'chinese-lower' | 'chinese-upper' | 'english-lower' | 'english-upper'>('arabic');
const startNumberInput = ref('');
const startNumber = ref(1);
const startNumberError = ref('');

// 处理返回按钮点击
function handleBack() {
  emit('back');
}

// 获取默认开始序号（序号类型首位）
function getDefaultStartNumber(): string {
  return formatNumber(1, numberType.value);
}

// 处理序号类型变化
function handleNumberTypeChange() {
  // 重置开始序号为默认值
  startNumber.value = 1;
  startNumberInput.value = '';
  startNumberError.value = '';
}

// 处理开始序号输入
function handleStartNumberInput(value: string) {
  startNumberError.value = '';
  if (!value || !value.trim()) {
    // 空值时重置为默认值
    startNumber.value = 1;
    return;
  }
  
  const parsed = parseStartNumber(value.trim(), numberType.value);
  if (parsed !== null) {
    startNumber.value = parsed;
    startNumberError.value = '';
  }
}

// 验证开始序号
function validateStartNumber() {
  if (!startNumberInput.value || !startNumberInput.value.trim()) {
    // 空值时使用默认值
    startNumber.value = 1;
    startNumberInput.value = '';
    startNumberError.value = '';
    return;
  }
  
  const parsed = parseStartNumber(startNumberInput.value.trim(), numberType.value);
  if (parsed === null) {
    // 输入不符合规则
    const typeNames: Record<string, string> = {
      'arabic': '阿拉伯数字（如：1, 2, 3）',
      'chinese-lower': '中文小写数字（如：一, 二, 三）',
      'chinese-upper': '中文大写数字（如：壹, 贰, 叁）',
      'english-lower': '英文小写字母（如：a, b, c）',
      'english-upper': '英文大写字母（如：A, B, C）',
    };
    startNumberError.value = `请输入有效的${typeNames[numberType.value] || '序号'}`;
    startNumber.value = 1;
  } else {
    startNumber.value = parsed;
    startNumberError.value = '';
  }
}

// 解析起始序号
function parseStartNumber(input: string, type: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  switch (type) {
    case 'arabic':
      const num = parseInt(trimmed, 10);
      return isNaN(num) ? null : Math.max(1, num);
    
    case 'chinese-lower':
      return parseChineseLower(trimmed);
    
    case 'chinese-upper':
      return parseChineseUpper(trimmed);
    
    case 'english-lower':
      return parseEnglishLower(trimmed);
    
    case 'english-upper':
      return parseEnglishUpper(trimmed);
    
    default:
      return null;
  }
}

// 解析中文小写数字
function parseChineseLower(str: string): number | null {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };
  if (str.length === 1 && map[str]) {
    return map[str];
  }
  return null;
}

// 解析中文大写数字
function parseChineseUpper(str: string): number | null {
  const map: Record<string, number> = {
    '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5,
    '陆': 6, '柒': 7, '捌': 8, '玖': 9, '拾': 10,
  };
  if (str.length === 1 && map[str]) {
    return map[str];
  }
  return null;
}

// 解析英文小写字母
function parseEnglishLower(str: string): number | null {
  if (str.length === 1) {
    const code = str.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      return code - 96; // a=1, b=2, ...
    }
  }
  return null;
}

// 解析英文大写字母
function parseEnglishUpper(str: string): number | null {
  if (str.length === 1) {
    const code = str.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return code - 64; // A=1, B=2, ...
    }
  }
  return null;
}

// 格式化序号
function formatNumber(num: number, type: string): string {
  let result = '';
  
  switch (type) {
    case 'arabic':
      result = String(num);
      break;
    
    case 'chinese-lower':
      result = formatChineseLower(num);
      break;
    
    case 'chinese-upper':
      result = formatChineseUpper(num);
      break;
    
    case 'english-lower':
      result = formatEnglishLower(num);
      break;
    
    case 'english-upper':
      result = formatEnglishUpper(num);
      break;
  }
  
  return result;
}

// 格式化中文小写数字
function formatChineseLower(num: number): string {
  const map: Record<number, string> = {
    1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
    6: '六', 7: '七', 8: '八', 9: '九', 10: '十',
  };
  if (num <= 10) {
    return map[num] || String(num);
  }
  // 大于10的简单处理
  return String(num);
}

// 格式化中文大写数字
function formatChineseUpper(num: number): string {
  const map: Record<number, string> = {
    1: '壹', 2: '贰', 3: '叁', 4: '肆', 5: '伍',
    6: '陆', 7: '柒', 8: '捌', 9: '玖', 10: '拾',
  };
  if (num <= 10) {
    return map[num] || String(num);
  }
  return String(num);
}

// 格式化英文小写字母
function formatEnglishLower(num: number): string {
  if (num >= 1 && num <= 26) {
    return String.fromCharCode(96 + num); // a-z
  }
  // 超过26的处理：aa, ab, ...
  let result = '';
  let n = num;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// 格式化英文大写字母
function formatEnglishUpper(num: number): string {
  if (num >= 1 && num <= 26) {
    return String.fromCharCode(64 + num); // A-Z
  }
  let result = '';
  let n = num;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// 是否可以重命名
const canRename = computed(() => {
  if (activeTab.value === 'fixed') {
    return fixedText.value.trim().length > 0;
  } else {
    return true; // 自动序号总是可以重命名
  }
});

// 处理重命名
function handleRename() {
  if (!canRename.value) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '请完善重命名配置',
      timeout: 2000,
    });
    return;
  }

  const config: any = {
    mode: activeTab.value,
    position: position.value,
  };

  if (activeTab.value === 'fixed') {
    config.text = fixedText.value.trim();
  } else {
    // 自动序号模式
    // 验证开始序号
    if (startNumberInput.value && startNumberInput.value.trim()) {
      const parsed = parseStartNumber(startNumberInput.value.trim(), numberType.value);
      if (parsed === null) {
        sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
          message: '开始序号格式不正确，请检查输入',
          timeout: 2000,
        });
        return;
      }
      config.startNumber = parsed;
    } else {
      config.startNumber = 1; // 默认值
    }
    config.numberType = numberType.value;
  }

  sendMsgToPlugin(MessageType.BATCH_RENAME, config);
}
</script>

<style lang="less" module>
.container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  z-index: 10;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  flex-shrink: 0;
  z-index: 11;
}

.backButton {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--input-bg);
    border-color: var(--button-primary-bg);
  }
  
  &:active {
    background-color: var(--bg-primary);
  }
}

.backIcon {
  font-size: 16px;
}

.title {
  flex: 1;
  text-align: right;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.tabs {
  display: flex;
  background-color: var(--input-bg);
  flex-shrink: 0;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  flex: 1;
  text-align: center;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  background-color: var(--bg-secondary);
  transition: all 0.2s;
  
  &:hover {
    color: var(--text-primary);
  }
  
  &.active {
    color: var(--button-primary-text);
    background-color: var(--button-primary-bg);
    font-weight: 500;
  }
}

.content {
  flex: 1;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  box-sizing: border-box;
}

.positionButtons {
  display: flex;
  gap: 8px;
}

.positionButton {
  flex: 1;
  border-radius: 6px;
  height: 36px;
  font-size: 14px;
}

.tabContent {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 120px;
}

.tip {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  line-height: 1.5;
}


.autoNumberSection {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selectWrapper,
.inputWrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 13px;
  color: var(--text-secondary);
}

.typeSelect {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  
  &:focus {
    border-color: var(--button-primary-bg);
  }
}


.errorText {
  font-size: 12px;
  color: #ee0a24;
  margin-top: -4px;
}

.renameButton {
  margin-top: 8px;
  border-radius: 6px;
  height: 44px;
  font-size: 15px;
  line-height: 42px;
}
</style>
