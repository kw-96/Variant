/**
 * 替换内部实例时的目标匹配（逻辑与历史实现保持一致，避免漏换/错换）
 */

import { REQUIRED_COMPONENT_SET_ORDER } from './component-utils';

/**
 * 是否为背景/IP/LOGO/主题等必需组件集槽位（预览替换时应跳过）
 */
export function isRequiredSetSlotName(name: string): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  for (const key of REQUIRED_COMPONENT_SET_ORDER) {
    if (n === key || n.startsWith(`${key}_`) || n.startsWith(`${key}=`)) {
      return true;
    }
  }
  return false;
}

/**
 * 从实例的变体属性中提取组件名称
 */
export function extractComponentNameFromVariant(instance: any): string | null {
  if (!instance || instance.type !== 'INSTANCE') return null;

  try {
    const variantProperties = (instance as any).variantProperties;
    if (!Array.isArray(variantProperties) || variantProperties.length === 0) {
      return null;
    }

    const variantValues: string[] = [];
    for (const variant of variantProperties) {
      if (!variant || typeof variant !== 'object') continue;
      let value: any = null;
      if (variant.value !== undefined) value = variant.value;
      else if (Array.isArray(variant.values) && variant.values.length > 0) value = variant.values[0];
      else if (Array.isArray(variant.options) && variant.options.length > 0) value = variant.options[0];

      if (value === null || value === undefined) continue;
      const strValue = String(value);
      const extracted = strValue.includes('=')
        ? strValue.split('=').pop()?.trim() || strValue
        : strValue;
      variantValues.push(extracted);
    }

    if (variantValues.length === 1) return variantValues[0];
    if (variantValues.length <= 1) return null;

    const descriptiveValue = variantValues.find((v) => v.includes('横') || v.includes('竖'));
    const typeValue = variantValues.find(
      (v) =>
        v.includes('LOGO') || v.includes('主题') || v.includes('背景') || v.includes('IP')
    );

    if (typeValue && descriptiveValue) return `${typeValue}_${descriptiveValue}`;
    if (descriptiveValue) {
      const otherValue = variantValues.find((v) => v !== descriptiveValue);
      if (otherValue) {
        if (
          otherValue.includes('LOGO') ||
          otherValue.includes('主题') ||
          otherValue.includes('背景') ||
          otherValue.includes('IP')
        ) {
          return `${otherValue}_${descriptiveValue}`;
        }
        return `${descriptiveValue}_${otherValue}`;
      }
      return descriptiveValue;
    }
    if (typeValue) return typeValue;
    return variantValues.join('_');
  } catch (e) {
    console.error('提取变体属性失败:', e);
    return null;
  }
}

/**
 * 在组件映射中查找替换目标
 */
export function findReplacementTarget(
  node: any,
  componentMap: Map<string, any>
): { targetComponent: any; matchedName: string } | null {
  if (componentMap.has(node.name)) {
    return { targetComponent: componentMap.get(node.name), matchedName: node.name };
  }

  const variantComponentName = extractComponentNameFromVariant(node);
  if (!variantComponentName) return null;

  if (componentMap.has(variantComponentName)) {
    return {
      targetComponent: componentMap.get(variantComponentName),
      matchedName: variantComponentName
    };
  }

  const variantProperties = (node as any).variantProperties;
  const allVariantValues: string[] = [];
  if (Array.isArray(variantProperties)) {
    variantProperties.forEach((v: any) => {
      let val: any = null;
      if (v?.value !== undefined) val = v.value;
      else if (Array.isArray(v?.values) && v.values.length > 0) val = v.values[0];
      else if (Array.isArray(v?.options) && v.options.length > 0) val = v.options[0];
      if (val === null || val === undefined) return;
      const strVal = String(val);
      const extracted = strVal.includes('=') ? strVal.split('=').pop()?.trim() : strVal;
      if (extracted) allVariantValues.push(extracted);
    });
  }

  for (const [componentName, component] of componentMap.entries()) {
    const matchesAll =
      allVariantValues.length > 0 &&
      allVariantValues.every((val: string) => componentName.includes(val));
    if (matchesAll) {
      return { targetComponent: component, matchedName: componentName };
    }
  }

  for (const [componentName, component] of componentMap.entries()) {
    if (
      componentName.includes(variantComponentName) ||
      variantComponentName.includes(componentName)
    ) {
      return { targetComponent: component, matchedName: componentName };
    }
  }

  return null;
}
