<template>
  <div :class="$style.container">
    <!-- 页面基础设置板块 -->
    <FormSection>
      <div :class="$style.formGroup">
          <label :class="$style.label">页面底色</label>
          <div :class="$style.colorInputGroup">
            <input 
              type="color" 
              v-model="formData.pageColor" 
              :class="$style.colorPicker"
              title="选择页面底色"
            />
            <input 
              type="text" 
              v-model="formData.pageColor" 
              :class="$style.colorValue"
              maxlength="7"
              placeholder="#FFFFFF"
              title="页面底色十六进制值"
            />
          </div>
        </div>
        
        <div :class="$style.formGroup">
          <label :class="$style.label">页面背景</label>
          <div :class="$style.fileUploadBtn">
            <input 
              ref="pageBackgroundInput"
              type="file" 
              accept="image/*" 
              :class="$style.hiddenFileInput"
              @change="handleImageUpload($event, 'pageBackground')"
            />
            <button 
              :class="$style.uploadBtn" 
              @click="triggerFileInput('pageBackgroundInput')"
              title="上传页面背景图片"
            >
              <div :class="$style.imgPreviewInline">
                <img 
                  v-if="imagePreviews.pageBackground" 
                  :src="imagePreviews.pageBackground" 
                  :class="$style.previewImage"
                />
                <van-icon v-else name="plus" :class="$style.uploadIconInline" />
              </div>
            </button>
          </div>
        </div>
    </FormSection>
    
    <!-- 头图板块 -->
    <FormSection>
      <div :class="$style.formGroup">
          <label :class="$style.label">头图</label>
          <div :class="$style.fileUploadBtn">
            <input 
              ref="headerImageInput"
              type="file" 
              accept="image/*" 
              :class="$style.hiddenFileInput"
              @change="handleImageUpload($event, 'headerImage')"
            />
            <button 
              :class="$style.uploadBtn" 
              @click="triggerFileInput('headerImageInput')"
              title="上传头图"
            >
              <div :class="$style.imgPreviewInline">
                <img 
                  v-if="imagePreviews.headerImage" 
                  :src="imagePreviews.headerImage" 
                  :class="$style.previewImage"
                />
                <van-icon v-else name="plus" :class="$style.uploadIconInline" />
              </div>
            </button>
          </div>
        </div>
    
        <div :class="$style.formGroup">
          <label :class="$style.label">标题</label>
          <div :class="$style.fileUploadBtn">
            <input 
              ref="titleUploadInput"
              type="file" 
              accept="image/*" 
              :class="$style.hiddenFileInput"
              @change="handleImageUpload($event, 'titleUpload')"
            />
            <button 
              :class="$style.uploadBtn" 
              @click="triggerFileInput('titleUploadInput')"
              title="上传标题图片"
            >
              <div :class="$style.imgPreviewInline">
                <img 
                  v-if="imagePreviews.titleUpload" 
                  :src="imagePreviews.titleUpload" 
                  :class="$style.previewImage"
                />
                <van-icon v-else name="plus" :class="$style.uploadIconInline" />
              </div>
            </button>
          </div>
        </div>
    </FormSection>
    
    <!-- 游戏信息板块 -->
    <div :class="$style.formSection">
      <div :class="$style.sectionHeader">
        <van-field
          v-model="gameInfoVersion"
          :class="$style.dropdownSelector"
          is-link
          readonly
          label="游戏信息版本"
          placeholder="选择游戏信息版本"
          @click="showGameInfoVersionPicker = true"
        />
        <van-popup v-model:show="showGameInfoVersionPicker" position="bottom">
          <van-picker
            :columns="gameInfoVersionOptions"
            @confirm="onGameInfoVersionConfirm"
            @cancel="showGameInfoVersionPicker = false"
          />
        </van-popup>
        <button 
          :class="$style.controlBtn" 
          @click="toggleCollapse('buttonVersionContent')"
          title="折叠/展开游戏信息板块"
        >
          <van-icon 
            :name="collapsedSections.buttonVersionContent ? 'arrow-down' : 'arrow-up'" 
            :class="$style.chevronIcon"
          />
        </button>
      </div>
      
      <div 
        v-show="!collapsedSections.buttonVersionContent"
        :class="$style.collapsibleContent"
      >
          <!-- 游戏icon版内容 (默认显示) -->
          <div v-if="gameInfoVersion === 'imageButton'" :class="$style.versionContent">
            <div :class="$style.formGroup">
              <label :class="$style.label">游戏icon</label>
              <div :class="$style.imgUploadWrapper">
                <input 
                  ref="gameIconUploadInput"
                  type="file" 
                  accept="image/*" 
                  :class="$style.hiddenFileInput"
                  @change="handleImageUpload($event, 'gameIcon')"
                />
                <div :class="$style.imgPreviewBtn" @click="triggerFileInput('gameIconUploadInput')">
                  <div :class="$style.imgPreviewContainer">
                    <img 
                      v-if="imagePreviews.gameIcon" 
                      :src="imagePreviews.gameIcon" 
                      :class="$style.previewImage"
                    />
                    <span v-else :class="$style.uploadIconText">+</span>
                  </div>
                </div>
              </div>
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">游戏名称</label>
              <van-field 
                v-model="formData.gameName" 
                placeholder="请输入游戏名称"
                :class="$style.textInput"
              />
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">游戏描述</label>
              <van-field 
                v-model="formData.gameCopy" 
                type="textarea"
                placeholder="请输入游戏宣传文案"
                :class="$style.textArea"
                rows="3"
              />
            </div>
            
            <div :class="$style.formGroup">
              <label :class="$style.label">文案颜色</label>
              <div :class="$style.colorInputGroup">
                <input 
                  type="color" 
                  v-model="formData.gameCopyTextColor" 
                  :class="$style.colorPicker"
                />
                <input 
                  type="text" 
                  v-model="formData.gameCopyTextColor" 
                  :class="$style.colorValue"
                  maxlength="7"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">按钮文本</label>
              <van-field 
                v-model="formData.iconButtonText" 
                placeholder="请输入按钮文案"
                :class="$style.textInput"
              />
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">文本颜色</label>
              <div :class="$style.colorInputGroup">
                <input 
                  type="color" 
                  v-model="formData.iconButtonTextColor" 
                  :class="$style.colorPicker"
                />
                <input 
                  type="text" 
                  v-model="formData.iconButtonTextColor" 
                  :class="$style.colorValue"
                  maxlength="7"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">按钮底</label>
              <div :class="$style.fileUploadBtn">
                <input 
                  ref="iconButtonBgUploadInput"
                  type="file" 
                  accept="image/*" 
                  :class="$style.hiddenFileInput"
                  @change="handleImageUpload($event, 'iconButtonBg')"
                />
                <button 
                  :class="$style.uploadBtn" 
                  @click="triggerFileInput('iconButtonBgUploadInput')"
                  title="上传按钮背景图片"
                >
                  <div :class="$style.imgPreviewInline">
                    <img 
                      v-if="imagePreviews.iconButtonBg" 
                      :src="imagePreviews.iconButtonBg" 
                      :class="$style.previewImage"
                    />
                    <van-icon v-else name="plus" :class="$style.uploadIconInline" />
                  </div>
                </button>
              </div>
            </div>
          </div>
          
          <!-- 单按钮版内容 -->
          <div v-if="gameInfoVersion === 'singleButton'" :class="$style.versionContent">
            <div :class="$style.formGroup">
              <label :class="$style.label">按钮文本</label>
              <van-field 
                v-model="formData.singleButtonText" 
                placeholder="请输入按钮文案"
                :class="$style.textInput"
              />
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">文本颜色</label>
              <div :class="$style.colorInputGroup">
                <input 
                  type="color" 
                  v-model="formData.singleButtonTextColor" 
                  :class="$style.colorPicker"
                />
                <input 
                  type="text" 
                  v-model="formData.singleButtonTextColor" 
                  :class="$style.colorValue"
                  maxlength="7"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">按钮底</label>
              <div :class="$style.fileUploadBtn">
                <input 
                  ref="singleButtonBgUploadInput"
                  type="file" 
                  accept="image/*" 
                  :class="$style.hiddenFileInput"
                  @change="handleImageUpload($event, 'singleButtonBg')"
                />
                <button 
                  :class="$style.uploadBtn" 
                  @click="triggerFileInput('singleButtonBgUploadInput')"
                  title="上传单按钮背景图片"
                >
                  <div :class="$style.imgPreviewInline">
                    <img 
                      v-if="imagePreviews.singleButtonBg" 
                      :src="imagePreviews.singleButtonBg" 
                      :class="$style.previewImage"
                    />
                    <van-icon v-else name="plus" :class="$style.uploadIconInline" />
                  </div>
                </button>
              </div>
            </div>
          </div>
          
          <!-- 双按钮版内容 -->
          <div v-if="gameInfoVersion === 'doubleButton'" :class="$style.versionContent">
            <div :class="$style.formGroup">
              <label :class="$style.label">左侧按钮文本</label>
              <van-field 
                v-model="formData.leftButtonText" 
                placeholder="请输入按钮文案"
                :class="$style.textInput"
              />
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">文本颜色</label>
              <div :class="$style.colorInputGroup">
                <input 
                  type="color" 
                  v-model="formData.leftButtonTextColor" 
                  :class="$style.colorPicker"
                />
                <input 
                  type="text" 
                  v-model="formData.leftButtonTextColor" 
                  :class="$style.colorValue"
                  maxlength="7"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">左侧按钮底</label>
              <div :class="$style.fileUploadBtn">
                <input 
                  ref="leftButtonBgUploadInput"
                  type="file" 
                  accept="image/*" 
                  :class="$style.hiddenFileInput"
                  @change="handleImageUpload($event, 'leftButtonBg')"
                />
                <button 
                  :class="$style.uploadBtn" 
                  @click="triggerFileInput('leftButtonBgUploadInput')"
                  title="上传左侧按钮背景图片"
                >
                  <div :class="$style.imgPreviewInline">
                    <img 
                      v-if="imagePreviews.leftButtonBg" 
                      :src="imagePreviews.leftButtonBg" 
                      :class="$style.previewImage"
                    />
                    <van-icon v-else name="plus" :class="$style.uploadIconInline" />
                  </div>
                </button>
              </div>
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">右侧按钮文本</label>
              <van-field 
                v-model="formData.rightButtonText" 
                placeholder="请输入按钮文案"
                :class="$style.textInput"
              />
            </div>

            <div :class="$style.formGroup">
              <label :class="$style.label">文本颜色</label>
              <div :class="$style.colorInputGroup">
                <input 
                  type="color" 
                  v-model="formData.rightButtonTextColor" 
                  :class="$style.colorPicker"
                />
                <input 
                  type="text" 
                  v-model="formData.rightButtonTextColor" 
                  :class="$style.colorValue"
                  maxlength="7"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
            
            <div :class="$style.formGroup">
              <label :class="$style.label">右侧按钮底</label>
              <div :class="$style.fileUploadBtn">
                <input 
                  ref="rightButtonBgUploadInput"
                  type="file" 
                  accept="image/*" 
                  :class="$style.hiddenFileInput"
                  @change="handleImageUpload($event, 'rightButtonBg')"
                />
                <button 
                  :class="$style.uploadBtn" 
                  @click="triggerFileInput('rightButtonBgUploadInput')"
                  title="上传右侧按钮背景图片"
                >
                  <div :class="$style.imgPreviewInline">
                    <img 
                      v-if="imagePreviews.rightButtonBg" 
                      :src="imagePreviews.rightButtonBg" 
                      :class="$style.previewImage"
                    />
                    <van-icon v-else name="plus" :class="$style.uploadIconInline" />
                  </div>
                </button>
              </div>
            </div>
            
            <div :class="$style.formGroup">
              <label :class="$style.label">按钮间距</label>
              <van-field 
                v-model="formData.btnSpacing" 
                type="number"
                :class="$style.numberInput"
                :min="0"
                :max="50"
                @update:model-value="formData.btnSpacing = Number($event) || 0"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 模块管理区域 -->
      <div :class="$style.formSection">
        <div :class="$style.sectionHeader">
          <span :class="$style.sectionTitle">自定义模块</span>
        </div>
        <div :class="$style.moduleSelectionContent">
          <div :class="$style.formGroup">
            <label :class="$style.label">模块类型</label>
            <van-field
              v-model="selectedModuleType"
              :class="$style.dropdownSelector"
              is-link
              readonly
              placeholder="请选择模块类型"
              @click="showModuleTypePicker = true"
            />
            <van-popup v-model:show="showModuleTypePicker" position="bottom">
              <van-picker
                :columns="moduleTypeOptions"
                @confirm="onModuleTypeConfirm"
                @cancel="showModuleTypePicker = false"
              />
            </van-popup>
          </div>
          <div :class="$style.formGroup">
            <van-button 
              type="primary" 
              block
              :class="$style.addModuleBtn"
              @click="handleAddModule"
              :disabled="!selectedModuleType"
            >
              添加模块
            </van-button>
          </div>
        </div>
        
        <!-- 已添加模块列表 -->
        <div :class="$style.moduleListHeader">
          <span>已添加模块</span>
          <div :class="$style.moduleCount">
            <span>{{ modules.length }}</span> 个模块
          </div>
        </div>
        
        <div :class="$style.modulesContainer">
          <div v-if="modules.length === 0" :class="$style.emptyModulesMessage">
            <van-icon name="apps-o" :class="$style.emptyIcon" />
            <p>尚未添加任何模块</p>
            <p :class="$style.hintText">请从上方选择模块类型并添加</p>
          </div>
          
          <div 
            v-for="(module, index) in modules" 
            :key="module.id"
            :class="$style.moduleItem"
          >
            <div :class="$style.moduleHeader">
              <div :class="$style.moduleTitle">{{ getModuleTypeName(module.type) }}</div>
              <div :class="$style.moduleControls">
                <button 
                  :class="$style.controlBtn" 
                  @click="moveModule(index, 'up')"
                  :disabled="index === 0"
                  title="上移"
                >
                  <van-icon name="arrow-up" />
                </button>
                <button 
                  :class="$style.controlBtn" 
                  @click="moveModule(index, 'down')"
                  :disabled="index === modules.length - 1"
                  title="下移"
                >
                  <van-icon name="arrow-down" />
                </button>
                <button 
                  :class="$style.controlBtn" 
                  @click="toggleModuleCollapse(module.id)"
                  title="展开/收起"
                >
                  <van-icon 
                    :name="collapsedModules[module.id] ? 'arrow-down' : 'arrow-up'" 
                  />
                </button>
                <button 
                  :class="$style.controlBtn" 
                  @click="removeModule(index)"
                  title="删除"
                >
                  <van-icon name="delete-o" />
                </button>
              </div>
            </div>
            <div 
              v-show="!collapsedModules[module.id]"
              :class="$style.moduleContent"
            >
              <!-- 模块内容将根据类型动态渲染 -->
              <component 
                :is="getModuleComponent(module.type)" 
                :module="module"
                :index="index"
                @update="updateModule(index, $event)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 活动规则板块 -->
      <FormSection 
        title="活动规则" 
        :collapsible="true"
        v-model="collapsedSections.rulesContent"
      >
        <div :class="$style.formGroup">
          <label :class="$style.label">标题文案</label>
            <van-field 
              v-model="formData.rulesTitle" 
              placeholder="请输入标题文案"
              :class="$style.textInput"
            />
          </div>

          <div :class="$style.formGroup">
            <label :class="$style.label">标题背景</label>
            <div :class="$style.fileUploadBtn">
              <input 
                ref="rulesBgUploadInput"
                type="file" 
                accept="image/*" 
                :class="$style.hiddenFileInput"
                @change="handleImageUpload($event, 'rulesBg')"
              />
              <button 
                :class="$style.uploadBtn" 
                @click="triggerFileInput('rulesBgUploadInput')"
                title="上传活动规则标题背景图片"
              >
                <div :class="$style.imgPreviewInline">
                  <img 
                    v-if="imagePreviews.rulesBg" 
                    :src="imagePreviews.rulesBg" 
                    :class="$style.previewImage"
                  />
                  <van-icon v-else name="plus" :class="$style.uploadIconInline" />
                </div>
              </button>
            </div>
          </div>
          
          <div :class="$style.formGroup">
            <label :class="$style.label">活动规则</label>
            <van-field 
              v-model="formData.rulesText" 
              type="textarea"
              placeholder="请输入活动规则内容"
              :class="$style.textArea"
              rows="4"
            />
        </div>
      </FormSection>

      <!-- 尾版板块 -->
      <FormSection 
        title="尾版" 
        :collapsible="true"
        v-model="collapsedSections.footerAreaContent"
      >
        <div :class="$style.formGroup">
          <label :class="$style.label">LOGO</label>
            <div :class="$style.fileUploadBtn">
              <input 
                ref="footerLogoUploadInput"
                type="file" 
                accept="image/*" 
                :class="$style.hiddenFileInput"
                @change="handleImageUpload($event, 'footerLogo')"
              />
              <button 
                :class="$style.uploadBtn" 
                @click="triggerFileInput('footerLogoUploadInput')"
                title="上传尾版LOGO图片"
              >
                <div :class="$style.imgPreviewInline">
                  <img 
                    v-if="imagePreviews.footerLogo" 
                    :src="imagePreviews.footerLogo" 
                    :class="$style.previewImage"
                  />
                  <van-icon v-else name="plus" :class="$style.uploadIconInline" />
                </div>
              </button>
            </div>
          </div>
          
          <div :class="$style.formGroup">
            <label :class="$style.label">尾版背景</label>
            <div :class="$style.fileUploadBtn">
              <input 
                ref="footerBgUploadInput"
                type="file" 
                accept="image/*" 
                :class="$style.hiddenFileInput"
                @change="handleImageUpload($event, 'footerBg')"
              />
              <button 
                :class="$style.uploadBtn" 
                @click="triggerFileInput('footerBgUploadInput')"
                title="上传尾版背景图片"
              >
                <div :class="$style.imgPreviewInline">
                  <img 
                    v-if="imagePreviews.footerBg" 
                    :src="imagePreviews.footerBg" 
                    :class="$style.previewImage"
                  />
                  <van-icon v-else name="plus" :class="$style.uploadIconInline" />
                </div>
              </button>
            </div>
        </div>
      </FormSection>

      <!-- 创建按钮容器 -->
      <div :class="$style.createBtnContainer">
        <div :class="$style.buttonGroup">
          <van-button 
            type="primary" 
            block
            :class="$style.createBtn"
            @click="handleCreate"
          >
            创建原型
          </van-button>
          <van-button 
            block
            :class="$style.resetBtn"
            @click="handleReset"
          >
            重置
          </van-button>
        </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive } from 'vue';
import FormSection from '../../components/FormSection.vue';

// 表单数据
const formData = reactive({
  pageColor: '#FFFFFF',
  gameName: '',
  gameCopy: '',
  gameCopyTextColor: '#FFFFFF',
  iconButtonText: '立即下载',
  iconButtonTextColor: '#FFFFFF',
  singleButtonText: '立即下载',
  singleButtonTextColor: '#FFFFFF',
  leftButtonText: '左侧按钮',
  leftButtonTextColor: '#FFFFFF',
  rightButtonText: '右侧按钮',
  rightButtonTextColor: '#FFFFFF',
  btnSpacing: 10,
  rulesTitle: '',
  rulesText: '',
});

// 游戏信息版本
const gameInfoVersion = ref('imageButton');
const showGameInfoVersionPicker = ref(false);
const gameInfoVersionOptions = [
  { text: '游戏信息-带icon版', value: 'imageButton' },
  { text: '游戏信息-单按钮版', value: 'singleButton' },
  { text: '游戏信息-双按钮版', value: 'doubleButton' },
];

// 折叠状态
const collapsedSections = reactive({
  buttonVersionContent: false,
  rulesContent: false,
  footerAreaContent: false,
});

// 图片预览
const imagePreviews = reactive<Record<string, string>>({});

// 模块管理
const selectedModuleType = ref('');
const showModuleTypePicker = ref(false);
const moduleTypeOptions = [
  { text: '九宫格抽奖', value: 'lotteryModule' },
  { text: '签到模块', value: 'signInModule' },
  { text: '集卡模块', value: 'collectModule' },
  { text: '活动详情', value: 'activityContentModule' },
  { text: '图片轮播（横版）', value: 'carouselModule' },
  { text: '图片轮播（竖版）', value: 'verticalCarouselModule' },
];

interface Module {
  id: string;
  type: string;
  data: any;
}

const modules = ref<Module[]>([]);
const collapsedModules = reactive<Record<string, boolean>>({});
let moduleIdCounter = 0;

// 方法
function triggerFileInput(refName: string) {
  const input = (refs as any)[refName]?.value;
  if (input) {
    input.click();
  }
}

function handleImageUpload(event: Event, key: string) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreviews[key] = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function toggleCollapse(section: string) {
  collapsedSections[section] = !collapsedSections[section];
}

function onGameInfoVersionConfirm({ selectedOptions }: any) {
  gameInfoVersion.value = selectedOptions[0].value;
  showGameInfoVersionPicker.value = false;
}

function onModuleTypeConfirm({ selectedOptions }: any) {
  selectedModuleType.value = selectedOptions[0].value;
  showModuleTypePicker.value = false;
}

function handleAddModule() {
  if (!selectedModuleType.value) return;
  
  const newModule: Module = {
    id: `module-${++moduleIdCounter}`,
    type: selectedModuleType.value,
    data: {},
  };
  
  modules.value.push(newModule);
  collapsedModules[newModule.id] = false;
  selectedModuleType.value = '';
}

function removeModule(index: number) {
  const module = modules.value[index];
  delete collapsedModules[module.id];
  modules.value.splice(index, 1);
}

function moveModule(index: number, direction: 'up' | 'down') {
  if (direction === 'up' && index > 0) {
    [modules.value[index - 1], modules.value[index]] = [modules.value[index], modules.value[index - 1]];
  } else if (direction === 'down' && index < modules.value.length - 1) {
    [modules.value[index], modules.value[index + 1]] = [modules.value[index + 1], modules.value[index]];
  }
}

function toggleModuleCollapse(moduleId: string) {
  collapsedModules[moduleId] = !collapsedModules[moduleId];
}

function getModuleTypeName(type: string): string {
  const option = moduleTypeOptions.find(opt => opt.value === type);
  return option?.text || type;
}

function getModuleComponent(_type: string) {
  // 这里可以根据模块类型返回不同的组件
  // 暂时返回一个简单的占位组件
  return 'div';
}

function updateModule(index: number, data: any) {
  if (modules.value[index]) {
    modules.value[index].data = { ...modules.value[index].data, ...data };
  }
}

function handleCreate() {
  // TODO: 实现创建原型逻辑
  console.log('创建原型', { formData, modules: modules.value });
}

function handleReset() {
  // 重置表单数据
  Object.assign(formData, {
    pageColor: '#FFFFFF',
    gameName: '',
    gameCopy: '',
    gameCopyTextColor: '#FFFFFF',
    iconButtonText: '立即下载',
    iconButtonTextColor: '#FFFFFF',
    singleButtonText: '立即下载',
    singleButtonTextColor: '#FFFFFF',
    leftButtonText: '左侧按钮',
    leftButtonTextColor: '#FFFFFF',
    rightButtonText: '右侧按钮',
    rightButtonTextColor: '#FFFFFF',
    btnSpacing: 10,
    rulesTitle: '',
    rulesText: '',
  });
  
  // 重置图片预览
  Object.keys(imagePreviews).forEach(key => {
    delete imagePreviews[key];
  });
  
  // 重置模块
  modules.value = [];
  Object.keys(collapsedModules).forEach(key => {
    delete collapsedModules[key];
  });
  
  // 重置游戏信息版本
  gameInfoVersion.value = 'imageButton';
}

// 创建 refs 对象用于存储文件输入引用
const refs: Record<string, any> = {};
const pageBackgroundInput = ref<HTMLInputElement | null>(null);
const headerImageInput = ref<HTMLInputElement | null>(null);
const titleUploadInput = ref<HTMLInputElement | null>(null);
const gameIconUploadInput = ref<HTMLInputElement | null>(null);
const iconButtonBgUploadInput = ref<HTMLInputElement | null>(null);
const singleButtonBgUploadInput = ref<HTMLInputElement | null>(null);
const leftButtonBgUploadInput = ref<HTMLInputElement | null>(null);
const rightButtonBgUploadInput = ref<HTMLInputElement | null>(null);
const rulesBgUploadInput = ref<HTMLInputElement | null>(null);
const footerLogoUploadInput = ref<HTMLInputElement | null>(null);
const footerBgUploadInput = ref<HTMLInputElement | null>(null);

// 将 refs 添加到 refs 对象
refs.pageBackgroundInput = pageBackgroundInput;
refs.headerImageInput = headerImageInput;
refs.titleUploadInput = titleUploadInput;
refs.gameIconUploadInput = gameIconUploadInput;
refs.iconButtonBgUploadInput = iconButtonBgUploadInput;
refs.singleButtonBgUploadInput = singleButtonBgUploadInput;
refs.leftButtonBgUploadInput = leftButtonBgUploadInput;
refs.rightButtonBgUploadInput = rightButtonBgUploadInput;
refs.rulesBgUploadInput = rulesBgUploadInput;
refs.footerLogoUploadInput = footerLogoUploadInput;
refs.footerBgUploadInput = footerBgUploadInput;
</script>

<style lang="less" module>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 12px;
}

.formSection {
  background-color: var(--bg-primary);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.formGroup {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  min-width: 80px;
  flex-shrink: 0;
}

.colorInputGroup {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.colorPicker {
  width: 40px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
}

.colorValue {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;
  width: 0;
  
  &:focus {
    outline: none;
    border-color: var(--button-primary-bg);
  }
}

.fileUploadBtn {
  display: flex;
  align-items: center;
}

.hiddenFileInput {
  display: none;
}

.uploadBtn {
  width: 60px;
  height: 60px;
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  
  &:hover {
    border-color: var(--button-primary-bg);
    background-color: var(--bg-primary);
  }
}

.imgPreviewInline {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
}

.previewImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.uploadIconInline {
  font-size: 20px;
  color: var(--text-secondary);
}

.imgUploadWrapper {
  display: flex;
  align-items: center;
}

.imgPreviewBtn {
  width: 60px;
  height: 60px;
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  
  &:hover {
    border-color: var(--button-primary-bg);
    background-color: var(--bg-primary);
  }
}

.imgPreviewContainer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
}

.uploadIconText {
  font-size: 20px;
  color: var(--text-secondary);
}

.textInput,
.textArea,
.numberInput {
  :global(.van-field__control) {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--input-bg);
    color: var(--text-primary);
    font-size: 13px;
    
    &:focus {
      outline: none;
      border-color: var(--button-primary-bg);
    }
  }
}

.textArea {
  :global(.van-field__control) {
    min-height: 80px;
    resize: vertical;
  }
}

.dropdownSelector {
  flex: 1;
  
  :global(.van-field__control) {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--input-bg);
    color: var(--text-primary);
    font-size: 13px;
  }
}

.controlBtn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background-color: var(--input-bg);
    color: var(--text-primary);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.chevronIcon {
  font-size: 12px;
}

.collapsibleContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.versionContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.moduleSelectionContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.addModuleBtn {
  margin-top: 8px;
}

.moduleListHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-top: 1px solid var(--border-color);
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-primary);
}

.moduleCount {
  color: var(--text-secondary);
  font-size: 13px;
}

.modulesContainer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.emptyModulesMessage {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
  
  p {
    margin: 8px 0;
    font-size: 13px;
  }
}

.hintText {
  font-size: 12px;
  opacity: 0.7;
}

.emptyIcon {
  font-size: 48px;
  opacity: 0.5;
  margin-bottom: 16px;
}

.moduleItem {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.moduleHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.moduleTitle {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.moduleControls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.moduleContent {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.createBtnContainer {
  padding: 16px 0 32px;
}

.buttonGroup {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.createBtn,
.resetBtn {
  height: 44px;
  border-radius: 6px;
  font-size: 15px;
}

.resetBtn {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  
  &:hover {
    background-color: var(--input-bg);
  }
}
</style>
