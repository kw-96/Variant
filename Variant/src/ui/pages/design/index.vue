<template>
  <div :class="$style.container">
    <div :class="$style.tips">
      请先将16:9和9:16素材整理为SVG格式导入<br />
      分别转为组件（Ctrl+Alt+K）
    </div>

    <div :class="$style.arrow">
      <van-icon name="arrow-down" />
    </div>

    <div :class="$style.constraintHint">
      素材元素为适应模式，背景为充满模式，注意校验
    </div>

    <van-button
      type="primary"
      :class="$style.constraintButton"
      @click="handleSimpleConstraint"
    >
      简单约束
    </van-button>

    <div :class="$style.arrow">
      <van-icon name="arrow-down" />
    </div>

    <textarea
      v-model="dataText"
      :class="$style.textarea"
      placeholder="*name *w *h *s *type&#10;&#10;&#10;&#10;&#10;&#10;&#10;
📋复制表格(含表头)
👆双击空白处可查看示例
⌨️手动输入请用[tab]隔开行内数据，[回车]换行
  name:资源位名称  w/h:宽/高  
  s:大小          type:格式"
      @dblclick="loadExample"
    />

    <van-button
      type="primary"
      block
      @click="handleGenerate"
      :class="[$style.generateButton, { [$style.disabled]: !hasInput }]"
      :disabled="!hasInput"
    >
      开始生成
    </van-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import { getExampleData } from '../create/exampleData';

// 数据定义
const dataText = ref('');

// 计算是否已输入数据
const hasInput = computed(() => dataText.value.trim().length > 0);

/**
 * 处理简单约束按钮点击
 */
function handleSimpleConstraint() {
  sendMsgToPlugin(MessageType.SIMPLE_CONSTRAINT);
}

/**
 * 加载示例数据
 */
function loadExample() {
  dataText.value = getExampleData();
}

/**
 * 处理开始生成按钮点击
 * 功能实现与资源位创建页面的创建对象按钮一致
 */
function handleGenerate() {
  if (!dataText.value.trim()) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '请输入数据',
      timeout: 2000,
    });
    return;
  }

  // 解析文本数据
  const normalized = dataText.value.trim().replace(/\s*([\t\n])\s*/g, '$1');
  dataText.value = normalized;
  const data = textToList(normalized);

  if (data.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '无法解析数据，请检查格式',
      timeout: 2000,
    });
    return;
  }

  // 验证必需字段
  const requiredFields = ['name', 'w', 'h'];
  const hasAllFields = data.every(item =>
    requiredFields.every(field => item[field] !== undefined && item[field] !== '')
  );

  if (!hasAllFields) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '数据格式错误，必须包含name、w、h字段',
      timeout: 2000,
    });
    return;
  }

  // 发送创建画板消息到插件
  sendMsgToPlugin(MessageType.CREATE_FRAMES, data);
}

/**
 * 将文本转换为对象数组
 * 与资源位创建页面的实现一致
 */
function textToList(text: string) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split('\t');
  const data = lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj: any = {};
    headers.forEach((header, index) => {
      const value = values[index];
      // 如果是数字，转换为数字类型
      if (/^\d+\.?\d*$/.test(value)) {
        obj[header] = parseFloat(value);
      } else {
        obj[header] = value || '';
      }
    });
    return obj;
  });

  return data;
}
</script>

<style lang="less" module>
.container {
  height: 95%;
  display: flex;
  flex-direction: column;
  padding: 0px 12px;
  gap: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.tips {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.8;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  flex-shrink: 0;
}

.arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
  
  :global(.van-icon) {
    font-size: 20px;
  }
}

.constraintHint {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: -8px;
  flex-shrink: 0;
}

.constraintButton {
  flex-shrink: 0;
}

.textarea {
  width: 100%;
  min-height: 47%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  resize: vertical;
  overflow-y: auto;
  
  &:focus {
    outline: none;
    border-color: var(--button-primary-bg);
  }
  
  &::placeholder {
    color: var(--text-secondary);
    opacity: 0.5;
  }
}

.generateButton {
  flex-shrink: 0;
  
  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>

