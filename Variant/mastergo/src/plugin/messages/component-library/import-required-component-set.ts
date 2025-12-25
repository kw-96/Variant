// @ts-nocheck
import { convertFrameToComponent } from './frame-to-component';
import { captureAutoLayoutProps, mergeAutoLayoutProps } from './auto-layout-props';

/**
 * 必需组件集导入（方案 B + 按需转换）
 * - 团队库组件集导入到画布后为“远端引用态”，不可见且不可直接编辑/复原为本地组件集。
 * - 正确用法：通过 `ComponentSetNode.children[i].createInstance()` 创建实例。
 * - 本需求：这些实例需要按指定顺序横向排列 → 立刻解绑 → 转为组件（并尽量保留自动布局属性）。
 *
 * 命名规则（以“值”为准）：
 * - 团队库组件集子组件展示名可能为“属性=值”（或“属性 1[a0]=值”），取等号后的“值”作为最终组件名。
 *
 * 参考文档：`ComponentSetNode` 与 WARNING
 * `https://developers.mastergo.com/apis/componentSetNode.html`
 */
export async function importRequiredComponentSet(
  ukey: string,
  description: string,
  currentPage: any,
  layout?: { x: number; y: number; gap?: number },
): Promise<{ success: boolean; componentSet: any; error?: string; endX?: number; maxHeight?: number; components?: Map<string, any> }> {
  try {
    if (!currentPage) {
      return { success: false, componentSet: null, error: '当前页面不可用' };
    }

    if (typeof mg.importComponentSetByKeyAsync !== 'function') {
      return { success: false, componentSet: null, error: 'importComponentSetByKeyAsync API 不存在' };
    }

    let componentSetNode: any;
    try {
      componentSetNode = await mg.importComponentSetByKeyAsync(String(ukey));
    } catch (error: any) {
      // 捕获导入错误，包括可能的 2022-return:5 等内部错误
      const errorMsg = error?.message || String(error) || '未知错误';
      return { 
        success: false, 
        componentSet: null, 
        error: `导入组件集失败：${errorMsg}。请检查组件是否在团队库中，或联系管理员。` 
      };
    }
    
    if (!componentSetNode) {
      return { success: false, componentSet: null, error: `导入组件集失败（返回空）：${description}` };
    }

    const children = componentSetNode.children || [];
    if (!Array.isArray(children) || children.length === 0) {
      return { success: false, componentSet: componentSetNode, error: `组件集没有子组件：${description}` };
    }

    const viewportCenter = mg.viewport.center;
    const gap = typeof layout?.gap === 'number' ? layout.gap : 20;
    let x = typeof layout?.x === 'number' ? layout.x : viewportCenter.x;
    const y = typeof layout?.y === 'number' ? layout.y : viewportCenter.y;

    // 子组件排序：先横后竖（以“值”命名判断）
    const items = children
      .filter((c: any) => c && typeof c.createInstance === 'function')
      .map((c: any) => {
        const rawName = String(c.name || '').trim();
        const valueName = extractVariantValueName(rawName) || description;
        return { child: c, valueName };
      })
      .sort((a: any, b: any) => {
        return getOrientationOrder(a.valueName) - getOrientationOrder(b.valueName);
      });

    let createdCount = 0;
    let maxHeight = 0; // 记录最大高度，用于返回实际高度
    const components = new Map<string, any>(); // 收集创建的组件（名称 -> 组件节点）
    
    for (const item of items) {
      try {
        const instance = item.child.createInstance();
        if (!instance) continue;

        // 排列位置
        currentPage.appendChild(instance);
        instance.x = x;
        instance.y = y;

        // 命名：以“值”为准
        const valueName = item.valueName;
        try {
          instance.name = valueName;
        } catch {
          // ignore: 某些节点可能不允许写 name
        }

        // 直接解绑
        const instanceAutoLayout = captureAutoLayoutProps(instance);
        const detached = instance.detachInstance();
        if (!detached) continue;

        // 转为组件（保留布局信息）
        const detachedAutoLayout = captureAutoLayoutProps(detached);
        const layoutInfo = mergeAutoLayoutProps(instanceAutoLayout, detachedAutoLayout);
        const component = convertFrameToComponent(detached, valueName, currentPage, layoutInfo);
        if (!component) continue;

        // 确保组件位置正确（转换后可能位置改变）
        component.x = x;
        component.y = y;

        // 对于 IP、LOGO、主题 组件，设置尺寸适应内容
        const shouldHugContents = valueName === 'IP_横' || valueName === 'IP_竖' ||
                                  valueName === 'LOGO_横' || valueName === 'LOGO_竖' ||
                                  valueName === '主题_横' || valueName === '主题_竖';
        if (shouldHugContents) {
          try {
            // 根据 MasterGo API 文档：
            // mainAxisSizingMode: 'FIXED' | 'AUTO' - 主轴方向尺寸模式
            // crossAxisSizingMode: 'FIXED' | 'AUTO' - 交叉轴方向尺寸模式
            // 'AUTO' 表示自动长度（适应内容），'FIXED' 表示固定长度
            if ('mainAxisSizingMode' in component) {
              (component as any).mainAxisSizingMode = 'AUTO';
            }
            if ('crossAxisSizingMode' in component) {
              (component as any).crossAxisSizingMode = 'AUTO';
            }
          } catch (e) {
            // 如果设置失败，静默处理
          }
        }

        // 收集组件（用于后续替换普通组件内部的实例）
        components.set(valueName, component);

        // 更新最大高度
        const componentHeight = Number(component.height) || 0;
        maxHeight = Math.max(maxHeight, componentHeight);

        createdCount += 1;
        x += (Number(component.width) || 0) + gap;
      } catch (e) {
        // 静默处理单个组件创建失败，继续处理其他组件
      }
    }

    if (createdCount === 0) {
      return {
        success: false,
        componentSet: componentSetNode,
        error: `组件集子组件实例创建失败：${description}`,
      };
    }

    return { success: true, componentSet: componentSetNode, endX: x, maxHeight, components };
  } catch (error: any) {
    const errorMsg = error?.message || String(error) || '未知错误';
    return { success: false, componentSet: null, error: `导入组件集失败: ${errorMsg}` };
  }
}

function extractVariantValueName(raw: string): string {
  if (!raw) return '';
  // 常见：属性=LOGO_横 / 属性 1[a0]=LOGO_横 / 尺寸=横
  if (raw.includes('=')) {
    return raw.split('=').pop()?.trim() || '';
  }
  return raw.trim();
}

function getOrientationOrder(name: string): number {
  const n = String(name || '');
  if (n.includes('横')) return 0;
  if (n.includes('竖')) return 1;
  return 2;
}


