<template>
  <div :class="$style.container">
    <!-- 上传区域（编辑态） -->
    <div :class="$style.uploadSection" v-show="!isPreview">
      <div :class="$style.uploadHint">点击 | 拖拽 | 输入</div>
      <div 
        :class="[$style.uploadArea, { [$style.dragover]: isDragging }]"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div :class="$style.uploadBtn" @click="imgInputRef?.click()">
          <input
            ref="imgInputRef"
            type="file"
            multiple
            accept="image/*"
            style="display: none;"
            @change="handleImgUpload"
          />
          <van-icon name="photo" size="40" />
        </div>
        <div :class="$style.uploadBtn" @click="excelInputRef?.click()">
          <input
            ref="excelInputRef"
            type="file"
            accept=".xlsx,.csv"
            style="display: none;"
            @change="handleExcelUpload"
          />
          <van-icon name="description" size="40" />
        </div>
        <div :class="$style.uploadBtn" @click="fileInputRef?.click()">
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,.xml"
            style="display: none;"
            @change="handleFileUpload"
          />
          <van-icon name="records" size="40" />
        </div>
      </div>
    </div>

    <!-- 文本输入区域（编辑态） -->
    <div :class="$style.textInputArea" v-show="!isPreview">
      <textarea
        v-model="dataText"
        :class="$style.textarea"
        placeholder="*name *w *h *s *type *safeArea&#10;&#10;&#10;&#10;&#10;&#10;&#10;&#10;&#10;
📋复制表格(含表头)
👆双击空白处可查看示例
⌨️手动输入请用[tab]隔开行内数据
🔲多个安全区请使用[;]隔开
  name:资源位名称  w/h:宽/高  s:大小
  type:格式       safeArea:安全区范围"
        @dblclick="loadExample"
      />
      
      <!-- 确认按钮或创建对象按钮 -->
      <van-button
        :type="hasInput ? 'primary' : 'default'"
        block
        @click="handleConfirm"
        :class="[$style.createBtn, { [$style.disabled]: !hasInput }]"
        :disabled="!hasInput"
      >
        {{ hasInput ? '确认' : '创建对象' }}
      </van-button>
    </div>

    <!-- 预览区域（预览态） -->
    <div :class="$style.previewArea" v-if="isPreview">
      <!-- 顶部操作栏：返回和清空按钮 -->
      <div :class="$style.previewToolbar">
        <van-button size="small" type="default" plain @click="backToEdit">返回</van-button>
        <van-button size="small" type="default" plain @click="clearData">清空</van-button>
      </div>
      <!-- 分割线 -->
      <div :class="$style.divider"></div>
      <!-- 标签列表 -->
      <div :class="$style.tagsContainer">
        <div
          v-for="(tag, index) in tagsList"
          :key="index"
          :class="$style.tag"
        >
          <span :class="$style.tagContent">
            {{ index + 1 }}. {{ tag.name }} {{ tag.w }}×{{ tag.h }} {{ tag.type || '' }}
          </span>
          <div :class="$style.tagClose" @click="removeTag(index)">
            ×
          </div>
        </div>
      </div>
      <!-- 创建对象按钮（保持在原位置） -->
      <van-button
        type="primary"
        block
        @click="createObjects"
        :class="$style.createBtn"
      >
        创建对象
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import * as XLSX from 'xlsx';
import { sendMsgToPlugin, addMessageListener } from '../../../messages';
import { MessageType } from '../../../messages';

// 数据定义
const dataText = ref('');
const isPreview = ref(false); // 是否处于预览态
const tagsList = ref<Array<{ name: string; w: number; h: number; type?: string }>>([]);
const isDragging = ref(false);
const frameData = ref<any[]>([]);

// 计算是否已输入数据
const hasInput = computed(() => dataText.value.trim().length > 0);

// 引用
const imgInputRef = ref<HTMLInputElement>();
const excelInputRef = ref<HTMLInputElement>();
const fileInputRef = ref<HTMLInputElement>();

// 生命周期
onMounted(() => {
  // 监听 getFrame 消息
  addMessageListener(MessageType.GET_FRAME, (data: string[]) => {
    handleGetFrame(data);
  });
});
/**
 * 处理确认按钮点击
 */
function handleConfirm() {
  if (!hasInput.value) {
    return; // 已被 disabled，这里只是防御性检查
  }
  confirmToPreview();
}

/**
 * 进入预览
 */
function confirmToPreview() {
  if (!dataText.value.trim()) {
    alert('请输入数据');
    return;
  }
  // 对齐原始版本：去除两侧空白并收敛制表/换行周围空白
  const normalized = dataText.value.trim().replace(/\s*([\t\n])\s*/g, '$1');
  dataText.value = normalized;
  const data = textToList(normalized);
  if (data.length === 0) {
    alert('无法解析数据，请检查格式');
    return;
  }
  updateTags(data);
  isPreview.value = true;
}

/**
 * 返回编辑
 */
function backToEdit() {
  isPreview.value = false;
}

/**
 * 清空数据并返回编辑
 */
function clearData() {
  dataText.value = '';
  tagsList.value = [];
  frameData.value = [];
  isPreview.value = false;
}

/**
 * 移除单个标签
 */
function removeTag(index: number) {
  tagsList.value.splice(index, 1);
}

onUnmounted(() => {
  // 清理监听器（如果有实现）
});

/**
 * 将文本转换为对象数组
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

/**
 * 裁剪图片为4096x4096的切片
 * @param w 图片宽度
 * @param h 图片高度
 * @param maxSize 切片最大尺寸
 */
function creCutArea(w: number, h: number, maxSize: number = 4096) {
  let W = w;
  let H = h;
  let cutW = 1;
  let cutH = 1;
  const cuts: any[] = [];

  // 如果图片尺寸小于maxSize，直接返回
  if (W <= maxSize && H <= maxSize) {
    return [{ w: W, h: H, x: 0, y: 0 }];
  }

  // 计算需要切片的数量
  cutW = Math.ceil(W / maxSize);
  cutH = Math.ceil(H / maxSize);

  const Ws = Math.ceil(W / cutW);
  const Hs = Math.ceil(H / cutH);
  const lastWs = W - (Ws * (cutW - 1));
  const lastHs = H - (Hs * (cutH - 1));

  let X = 0;
  let Y = 0;

  for (let i = 0; i < cutW * cutH; i++) {
    const isLastRow = Math.floor(i / cutW) === cutH - 1;
    const isLastCol = (i + 1) % cutW === 0;

    let sliceW = isLastCol ? lastWs : Ws;
    let sliceH = isLastRow ? lastHs : Hs;

    cuts.push({ w: sliceW, h: sliceH, x: X, y: Y });

    X += Ws;
    if ((i + 1) % cutW === 0) {
      X = 0;
      Y += Hs;
    }
  }

  return cuts;
}

/**
 * 裁剪图片为切片
 * @param file 图片文件
 */
async function cutImgToCanvas(file: File): Promise<{ imgs: Uint8Array[], cuts: any[] }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      // 计算切片
      const cuts = creCutArea(img.width, img.height);
      const cutImgs: Uint8Array[] = [];

      cuts.forEach((cut) => {
        const canvas2 = document.createElement('canvas');
        canvas2.width = cut.w;
        canvas2.height = cut.h;
        const ctx2 = canvas2.getContext('2d');

        if (ctx && ctx2) {
          ctx2.drawImage(canvas, cut.x, cut.y, cut.w, cut.h, 0, 0, cut.w, cut.h);
          const dataURL = canvas2.toDataURL('image/png');
          const base64 = dataURL.split(',')[1];
          const imgData = new Uint8Array(
            atob(base64)
              .split('')
              .map((c) => c.charCodeAt(0))
          );
          cutImgs.push(imgData);
        }
      });

      resolve({ imgs: cutImgs, cuts });
      URL.revokeObjectURL(url);
    };

    img.src = url;
  });
}

/**
 * 处理图片上传
 * 裁剪大图并导入
 */
function handleImgUpload(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  
  const imgType = ['png', 'jpg', 'jpeg', 'webp', 'jfif'];
  const imageFiles: File[] = [];
  
  // 筛选图片文件
  Array.from(files).forEach(file => {
    const names = file.name.split('.');
    const extension = names[names.length - 1].toLowerCase();
    
    if (imgType.indexOf(extension) !== -1) {
      imageFiles.push(file);
    }
  });

  if (imageFiles.length === 0) {
    alert('没有有效的图片文件');
    return;
  }

  // 发送导入数量
  sendMsgToPlugin(MessageType.IMPORT_IMAGES, imageFiles.length);

  // 处理每个图片文件
  imageFiles.forEach((file) => {
    const names = file.name.split('.');
    const nameWithoutExt = names.slice(0, -1).join('.');

    cutImgToCanvas(file).then(({ imgs, cuts }) => {
      // 发送每个切片
      sendMsgToPlugin(MessageType.IMPORT_IMAGES, imgs.map((img, i) => ({
        img,
        w: cuts[i].w,
        h: cuts[i].h,
        name: cuts.length > 1 ? `${nameWithoutExt}-${i + 1}` : nameWithoutExt,
        x: cuts[i].x,
        y: cuts[i].y,
      })));
    });
  });
}

/**
 * 处理Excel上传
 */
function handleExcelUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // 读取第一个工作表
      const wsname = workbook.SheetNames[0];
      const ws = workbook.Sheets[wsname];
      
      // 转换为JSON
      const jsonData = XLSX.utils.sheet_to_json(ws);
      
      // 处理数据
      frameData.value = jsonData as any[];
      
      // 生成标签并进入预览
      updateTags(jsonData as any[]);
      fillTextArea(jsonData as any[]);
      isPreview.value = true;
      
      console.log('Excel数据加载成功:', jsonData.length, '条记录');
    } catch (error) {
      console.error('Excel解析失败:', error);
      alert('Excel文件解析失败，请检查文件格式');
    }
  };
  
  reader.readAsArrayBuffer(file);
}

/**
 * 处理JSON/XML文件上传
 */
function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;
      const jsonData = JSON.parse(text);
      
      // 处理数据
      frameData.value = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      // 生成标签并进入预览
      updateTags(frameData.value);
      fillTextArea(frameData.value);
      isPreview.value = true;
      
      console.log('JSON数据加载成功:', frameData.value.length, '条记录');
    } catch (error) {
      console.error('文件解析失败:', error);
      alert('文件解析失败，请检查文件格式');
    }
  };
  
  reader.readAsText(file);
}

/**
 * 更新标签列表
 */
function updateTags(data: any[]) {
  tagsList.value = data.map(item => ({
    name: item.name || '',
    w: item.w || 0,
    h: item.h || 0,
    type: item.type || ''
  }));
}

/**
 * 填充文本区域
 */
function fillTextArea(data: any[]) {
  if (data.length === 0) return;
  
  // 获取所有列名
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });
  
  const headers = Array.from(allKeys);
  const rows = data.map(item => {
    return headers.map(header => item[header] ?? '').join('\t');
  });
  
  dataText.value = headers.join('\t') + '\n' + rows.join('\n');
}

/**
 * 拖拽事件处理
 */
function handleDragOver() {
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  
  // 根据文件类型分发处理
  const file = files[0];
  const fileName = file.name.toLowerCase();
  
  if (fileName.match(/\.(jpg|jpeg|png|gif|webp|jfif)$/i)) {
    // 图片文件
    handleImgUpload({ target: { files } } as any);
  } else if (fileName.match(/\.(xlsx|csv)$/i)) {
    // Excel文件
    handleExcelUpload({ target: { files } } as any);
  } else if (fileName.match(/\.(json|xml)$/i)) {
    // JSON/XML文件
    handleFileUpload({ target: { files } } as any);
  }
}

/**
 * 加载示例数据
 */
function loadExample() {
  dataText.value = `name\tw\th\ts\ttype\tsafeArea
游戏中心-闪屏（常规样式）\t1080\t2400\t500k\tjpg\tleft:96, right: 96, top: 336, bottom: 858;left:96, right: 624, top: 336, bottom: 1980;left:123, right: 126, top: 1590, bottom: 648
游戏中心-节点推广\t984\t554\t1000k\tjpg\tleft:48, right: 48, top: 48, bottom: 50`;
}

/**
 * 处理 getFrame 消息
 * 将选中画板的尺寸信息填入文本框
 */
function handleGetFrame(data: string[]) {
  if (!data || data.length === 0) return;
  
  // 构建表头和数据行
  const header = 'name\tw\th';
  const rows = data.join('');
  
  // 填充到文本框
  dataText.value = header + '\n' + rows;
  
  // 更新标签
  const textData = textToList(dataText.value);
  updateTags(textData);
  isPreview.value = true;
}

/**
 * 创建对象
 */
function createObjects() {
  if (!dataText.value.trim()) {
    alert('请输入数据');
    return;
  }
  
  // 解析文本数据
  const normalized = dataText.value.trim().replace(/\s*([\t\n])\s*/g, '$1');
  dataText.value = normalized;
  const data = textToList(normalized);
  
  if (data.length === 0) {
    alert('无法解析数据，请检查格式');
    return;
  }
  
  // 验证必需字段
  const requiredFields = ['name', 'w', 'h'];
  const hasAllFields = data.every(item => 
    requiredFields.every(field => item[field] !== undefined && item[field] !== '')
  );
  
  if (!hasAllFields) {
    alert('数据格式错误，必须包含name、w、h字段');
    return;
  }
  
  // 发送创建画板消息到插件
  sendMsgToPlugin(MessageType.CREATE_FRAMES, data);
  
  // 创建后保持在预览态，用户可继续清空/返回/再次创建
}
</script>

<style lang="less" module>
.container {
  height: 95%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}

.uploadSection {
  margin-bottom: 24px;
  flex-shrink: 0;
}

.uploadHint {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 8px;
}

.uploadArea {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  padding: 10px;
  transition: all 0.2s;
  
  &.dragover {
    border-color: var(--button-primary-bg);
    background-color: var(--bg-secondary);
  }
}

.uploadBtn {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  
  &:hover {
    color: var(--button-primary-bg);
  }
  
  :global(.van-icon) {
    opacity: 0.6;
  }
}

.textInputArea {
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.textarea {
  width: 100%;
  height: 500px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 12px;
  resize: none;
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

.createBtn {
  flex-shrink: 0;
  
  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.previewArea {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

.previewToolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 2px 0;
}

.divider {
  width: 100%;
  height: 1px;
  background-color: var(--divider-color);
  flex-shrink: 0;
}

.tagsContainer {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  align-content: flex-start;
}

.tag {
  padding: 4px 10px;
  background-color: var(--tag-bg);
  border: 1px solid var(--tag-border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--tag-text);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  width: fit-content;
}

.tagContent {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tagClose {
  cursor: pointer;
  margin-left: 8px;
  width: 10px;
  height: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.2s;
  flex-shrink: 0;
  
  &:hover {
    opacity: 1;
  }
}
</style>
