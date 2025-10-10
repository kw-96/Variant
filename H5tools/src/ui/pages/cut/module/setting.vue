<template>
  <van-popup v-model:show="show" position="bottom" :style="{ height: '80%' }">
    <div :class="$style.container">
      <h3>扩展规则</h3>
      <van-divider />
      <h4>首图</h4>
      <van-dropdown-menu>
        <van-dropdown-item
          v-model="props.settingData.firstPic.expandRule"
          :options="expandRules.firstPic.rules"
        />
      </van-dropdown-menu>
      <van-field
        v-if="
          [
            HEAD_PIC_EXPAND_RULE.FILL_BOTTOM_COLOR,
            HEAD_PIC_EXPAND_RULE.FILL_TOP_COLOR,
          ].indexOf(props.settingData.firstPic.expandRule) !== -1
        "
        v-model="props.settingData.firstPic.fillColor"
        label="选择扩展色块"
        type="color"
        :class="$style.color"
      />
      <van-field
        v-else
        v-model="props.settingData.firstPic.lockNum"
        label="拉伸区域（px）"
        type="digit"
        :min="1"
        :class="$style.color"
      />
      <h4>其他</h4>
      <h5>头部</h5>
      <van-field
        v-model="props.settingData.otherPic.header.lockRatio"
        label="固定不裁剪比例（0～1）"
        type="number"
        :max="1"
        :min="0"
      />
      <h5>中部</h5>
      <van-dropdown-menu>
        <van-dropdown-item
          v-model="props.settingData.otherPic.body.expandRule"
          :options="expandRules.otherPic.body.rules"
        />
      </van-dropdown-menu>
      <van-field
        v-if="props.settingData.otherPic.body.expandRule === FILL_RULE.FILL_COLOR"
        v-model="props.settingData.otherPic.body.fillColor"
        label="选择扩展色块"
        type="color"
        :class="$style.color"
      />
      <h5>底部</h5>

      <van-field
        v-model="props.settingData.otherPic.footer.lockRatio"
        label="固定不裁剪比例（0～1）"
        type="number"
        :max="1"
        :min="0"
      />
    </div>
    <van-button
      type="primary"
      size="small"
      style="position: fixed; bottom: 12px; left: 12px; right: 12px"
      @click="$emit('onSave')"
    >
      保存配置
    </van-button>
  </van-popup>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { FILL_RULE, HEAD_PIC_EXPAND_RULE } from '../../../../config/rule';
import { getExpandRules } from '../../../js/setting/one-click-expand';

const props = defineProps({
  settingData: {
    type: Object,
    required: true,
    default: () => ({
      firstPic: {
        expandRule: '',
        fillColor: '#000000',
        lockNum: 0
      },
      otherPic: {
        header: { lockRatio: 0 },
        body: { expandRule: '', fillColor: '#000000' },
        footer: { lockRatio: 0 }
      }
    })
  },
});

const expandRules = getExpandRules();

const show = ref(false);

defineExpose({
  show,
});
</script>

<style lang="less" module>
.container {
  --van-dropdown-menu-height: 36px;
  --van-field-label-width: 50%;

  padding: 12px 12px 40px;
  text-align: left;

  h4 {
    margin: 12px 0;
  }

  h5 {
    margin: 8px 0;
  }

  :global(.van-field__body) {
    background-color: #f5f5f5;
  }
}
</style>
