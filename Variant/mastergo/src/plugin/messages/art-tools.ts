/**
 * 美术工具（主线程侧）—— 由 MG插件 index.js 移植
 * 覆盖：组件属性/奖品替换、H5一级标替换、通用替换（文本/图片属性、图层名）、
 *       统一命名、资源位导出（渠道压缩由 UI 完成，这里只负责导出字节）、隐藏规范、使用统计、选区信息。
 * 说明：全部逻辑基于 mg.* API，与 MG插件行为一致。
 */
import { MessageType, sendMsgToUI } from '../../../../src/messages';
import { getCachedCatalog } from './component-library/catalog-loader';
import { collectTextNodes } from '../utils/node-utils';

const M: any = mg as any;

/* ============================ 通用工具 ============================ */

function getVariantProps(instance: any): Array<{ name: string; value: string }> {
  let vp: any;
  try {
    vp = instance.variantProperties;
  } catch (e) {
    return [];
  }
  if (!vp) return [];
  if (Array.isArray(vp)) {
    return vp
      .filter((p: any) => p != null)
      .map((p: any) => ({ name: p.name !== undefined ? p.name : p.property, value: p.value }));
  }
  if (typeof vp === 'object') {
    return Object.keys(vp).map((k) => ({ name: k, value: vp[k] }));
  }
  return [];
}

function readVariantValue(instance: any, propName: string): string | undefined {
  const entry = getVariantProps(instance).filter((p) => p.name === propName)[0];
  return entry ? entry.value : undefined;
}

function getVariantPropsWithOptions(instance: any): any[] {
  return getVariantProps(instance).map((p) => {
    const info = readVariantOptions(instance, p.name);
    return { name: p.name, value: p.value, options: info.options, optionSource: info.source };
  });
}

function trySwitchVariant(instance: any, propName: string, targetValue: string) {
  const payload: any = { [propName]: targetValue };
  const attempts: string[] = [];
  const methods = ['setVariantPropertyValues', 'setProperties'];
  for (let i = 0; i < methods.length; i++) {
    const m = methods[i];
    if (typeof instance[m] !== 'function') {
      attempts.push(m + '：无此方法');
      continue;
    }
    let err = '';
    try {
      instance[m](payload);
    } catch (e: any) {
      err = String((e && e.message) || e);
    }
    const after = readVariantValue(instance, propName);
    attempts.push(m + (err ? '：异常(' + err + ')' : '：调用后值=' + after));
    if (!err && after === targetValue) {
      return { ok: true, method: m, attempts };
    }
  }
  return { ok: false, method: null, attempts };
}

function findComponentSet(instance: any): any {
  let main: any = null;
  try {
    main = instance.mainComponent;
  } catch (e) {
    main = null;
  }
  if (!main) return null;
  let node = main;
  while (node) {
    if (node.type === 'COMPONENT_SET') return node;
    try {
      node = node.parent;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function readVariantOptions(instance: any, propName: string): { options: string[]; source: string; raw: any } {
  const setNode = findComponentSet(instance);
  if (!setNode) return { options: [], source: '未找到组件集', raw: null };
  let values: any;
  try {
    values = setNode.componentPropertyValues;
  } catch (e) {
    return { options: [], source: '读取 componentPropertyValues 失败', raw: String(e) };
  }
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    const direct = values[propName];
    if (direct && Array.isArray(direct.variantOptions)) {
      return { options: direct.variantOptions, source: '组件集(对象/直取)', raw: values };
    }
    for (const key in values) {
      const v = values[key];
      if (v && v.type === 'VARIANT' && (v.name === propName || key === propName) && Array.isArray(v.variantOptions)) {
        return { options: v.variantOptions, source: '组件集(对象/遍历)', raw: values };
      }
    }
  }
  if (Array.isArray(values)) {
    const entry = values.filter((v: any) => v && v.type === 'VARIANT' && v.name === propName)[0];
    if (entry && Array.isArray(entry.variantOptions)) {
      return { options: entry.variantOptions, source: '组件集(数组)', raw: values };
    }
  }
  return { options: [], source: '组件集中未找到该 VARIANT 属性', raw: values };
}

function findVariantMatch(root: any, value: string): { inst: any; name: string } | null {
  const insts = collectInstances(root, []);
  for (let i = 0; i < insts.length; i++) {
    const inst = insts[i];
    const props = getVariantPropsWithOptions(inst);
    const hit = props.filter((p: any) => p.options && p.options.indexOf(value) !== -1)[0];
    if (hit) return { inst, name: hit.name };
  }
  return null;
}

function findDeepByName(root: any, name: string, pred?: (n: any) => boolean): any {
  let kids: any;
  try {
    kids = root.children;
  } catch (e) {
    kids = null;
  }
  if (!kids) return null;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i];
    if (c.name === name && (!pred || pred(c))) return c;
    const found = findDeepByName(c, name, pred);
    if (found) return found;
  }
  return null;
}

async function setTextSafe(textNode: any, value: string) {
  try {
    const MIXED = typeof mg !== 'undefined' && M.mixed ? M.mixed : undefined;
    const fn = textNode.fontName;
    if (fn && fn !== MIXED) {
      await M.loadFontAsync(fn);
    } else {
      const len = (textNode.characters || '').length;
      const seen: any = {};
      for (let i = 0; i < len; i++) {
        let f: any;
        try {
          f = textNode.getRangeFontName(i, i + 1);
        } catch (e) {
          continue;
        }
        const key = f && f.family + '/' + f.style;
        if (f && key && !seen[key]) {
          seen[key] = 1;
          await M.loadFontAsync(f);
        }
      }
    }
  } catch (e) {
    // 加载失败仍尝试写入
  }
  textNode.characters = value;
}

function makePrizeInstance(tpl: any): any {
  if (tpl.type === 'COMPONENT') return tpl.createInstance();
  if (tpl.type === 'COMPONENT_SET') {
    const def = tpl.defaultVariant || (tpl.children && tpl.children[0]) || null;
    if (!def || typeof def.createInstance !== 'function') throw new Error('组件集无可用变体');
    return def.createInstance();
  }
  return tpl.clone();
}

function collectInstances(root: any, acc: any[]): any[] {
  if (root && root.type === 'INSTANCE') acc.push(root);
  let kids: any;
  try {
    kids = root.children;
  } catch (e) {
    kids = null;
  }
  if (kids) for (let i = 0; i < kids.length; i++) collectInstances(kids[i], acc);
  return acc;
}

function stripPropId(key: any): string {
  return String(key).split('#')[0];
}

function normalizeCompProps(cp: any): Array<{ key: any; name: string; type: string }> {
  const out: any[] = [];
  if (!cp) return out;
  if (Array.isArray(cp)) {
    for (let i = 0; i < cp.length; i++) {
      const p = cp[i];
      if (!p) continue;
      const key = p.id !== undefined ? p.id : p.key !== undefined ? p.key : p.name;
      out.push({ key, name: stripPropId(p.name !== undefined ? p.name : String(key)), type: p.type });
    }
    return out;
  }
  if (typeof cp === 'object') {
    for (const key in cp) {
      const def = cp[key];
      out.push({ key, name: stripPropId(key), type: def && def.type });
    }
  }
  return out;
}

async function updateNamedText(clone: any, value: string): Promise<boolean> {
  let did = false;
  const insts = collectInstances(clone, []);
  for (let i = 0; i < insts.length; i++) {
    const inst = insts[i];
    let cp: any;
    try {
      cp = inst.componentProperties;
    } catch (e) {
      cp = null;
    }
    if (cp && typeof cp === 'object') {
      const payload: any = {};
      for (const key in cp) {
        const def = cp[key];
        if (def && def.type === 'TEXT' && stripPropId(key) === '奖品名称') payload[key] = value;
      }
      if (Object.keys(payload).length) {
        try {
          inst.setProperties(payload);
          did = true;
        } catch (e) {}
      }
    }
  }
  const textNode = findDeepByName(clone, '奖品名称', (n: any) => n.type === 'TEXT');
  if (textNode) {
    try {
      await setTextSafe(textNode, value);
      did = true;
    } catch (e) {}
  }
  return did;
}

async function updateAllTextProps(clone: any, value: string, propName?: string): Promise<boolean> {
  let did = false;
  const wantName = (propName || '').trim();
  const insts = collectInstances(clone, []);
  for (let i = 0; i < insts.length; i++) {
    const inst = insts[i];
    let cp: any;
    try {
      cp = inst.componentProperties;
    } catch (e) {
      cp = null;
    }
    const entries = normalizeCompProps(cp);
    const payload: any = {};
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j];
      if (e.type !== 'TEXT') continue;
      if (wantName && e.name !== wantName) continue;
      payload[e.key] = value;
    }
    if (Object.keys(payload).length) {
      try {
        inst.setProperties(payload);
        did = true;
      } catch (e) {}
    }
  }
  const texts = collectTextNodes(clone);
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (wantName) {
      let refName = '';
      try {
        const ref = t.componentPropertyReferences;
        refName = ref && ref.characters ? stripPropId(ref.characters) : '';
      } catch (e) {
        refName = '';
      }
      if ((t.name || '').trim() !== wantName && refName !== wantName) continue;
    }
    try {
      await setTextSafe(t, value);
      did = true;
    } catch (e) {}
  }
  return did;
}

async function applyPrizeToInstance(clone: any, name: string, scope?: string, propName?: string): Promise<string | null> {
  const wantName = (propName || '').trim();
  let switched = false;
  let switchOk = false;
  let matchedName = '';
  if (scope === undefined || scope === 'variant') {
    const insts = collectInstances(clone, []);
    for (let i = 0; i < insts.length; i++) {
      const inst = insts[i];
      const props = getVariantPropsWithOptions(inst);
      let hit: any;
      if (wantName) {
        hit = props.filter((p: any) => p.name === wantName && p.options && p.options.indexOf(name) !== -1)[0];
      } else {
        hit = props.filter((p: any) => p.options && p.options.indexOf(name) !== -1)[0];
      }
      if (hit) {
        matchedName = hit.name;
        // 回读校验：避免「调用未报错但实际没切换成功」被当成成功
        const result = trySwitchVariant(inst, hit.name, name);
        switched = true;
        switchOk = result.ok;
        break;
      }
    }
  }
  // 图片替换模式必须校验变体确实切换成功；文本模式只要求文本写入
  if (scope === 'variant') {
    if (!switched) return `未找到与“${name}”完全匹配的变体属性`;
    return switchOk ? null : `切换“${matchedName}”后回读值未变为目标值`;
  }
  if (scope === undefined || scope === 'text') {
    await updateAllTextProps(clone, name, wantName);
  }
  return null;
}

function matchCategory(node: any, category: string): boolean {
  const t = node.type;
  if (category === 'all') return true;
  if (category === 'text') return t === 'TEXT';
  if (category === 'instance') return t === 'INSTANCE' || t === 'COMPONENT';
  if (category === 'frame') return t === 'FRAME' || t === 'COMPONENT_SET';
  if (category === 'section') return t === 'SECTION';
  if (category === 'group') return t === 'GROUP';
  return true;
}

function matchAnyCategory(node: any, categories: string[]): boolean {
  const cats = Array.isArray(categories) ? categories : [];
  if (cats.length === 0 || cats.indexOf('all') !== -1) return true;
  return cats.some((c) => matchCategory(node, c));
}

/* ============================ 资源位导出：组件描述匹配 ============================ */

// 归一化画板/组件名：去除旧版 #编号前缀、H5 前缀、尺寸、文件大小、预览/正式等后缀，便于与组件库匹配
function normalizeForMatch(raw: string): string {
  let s = String(raw || '').trim();
  // 旧版 #编号 前缀（#24 - / #43-）
  s = s.replace(/^#\d+\s*[-–—‑_]*\s*/, '');
  // H5 前缀
  s = s.replace(/^h5\s*[-–—‑_]?\s*/i, '');
  // 尺寸 1080x380 / 1080×380 / 1080*380
  s = s.replace(/[\s_\-–—‑]*\d{2,5}\s*[x×*]\s*\d{2,5}(?!\w)/gi, ' ');
  // 文件大小 500k / 150kb / 2m / 2mb
  s = s.replace(/[\s_\-–—‑]*\d+(?:\.\d+)?\s*(?:kb|mb|k|m|b)(?!\w)/gi, ' ');
  // 预览 / 正式 等标记
  s = s.replace(/[\s_\-–—‑]*(?:预览图组|预览图|预览稿|预览|preview|正式图|正式稿|正式)(?!\w)/gi, ' ');
  // 结尾孤立数字
  s = s.replace(/[\s_\-–—‑]*\d+\s*$/, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // 结尾连接符
  s = s.replace(/[-–—‑_\s]+$/, '').trim();
  return s;
}

// 比较用规范化：在归一化基础上去掉所有连接符（横杠/下划线/空格），消除连接符差异
function canonicalForMatch(raw: string): string {
  return normalizeForMatch(raw).toLowerCase().replace(/[\s_\-–—‑]/g, '');
}

// 读不到画板隐藏数据时，按名称在当前组件库中匹配对应的完整组件描述；匹配不到返回 ''
function matchCatalogDescription(name: string): string {
  let catalog: any[] | null = null;
  try {
    catalog = getCachedCatalog();
  } catch (e) {
    catalog = null;
  }
  if (!catalog || !catalog.length) return '';
  const norm = canonicalForMatch(name);
  if (!norm) return '';

  // 1) 画板名（规范化）命中组件名 → 用该组件的完整描述
  for (let i = 0; i < catalog.length; i++) {
    const c = catalog[i];
    const d = String((c && c.description) || '').trim();
    if (!d) continue;
    const cn = canonicalForMatch(String((c && c.name) || ''));
    if (cn && cn === norm) return d;
  }
  // 2) 画板名（规范化）命中完整描述本身
  for (let i = 0; i < catalog.length; i++) {
    const c = catalog[i];
    const d = String((c && c.description) || '').trim();
    if (!d) continue;
    const dn = canonicalForMatch(d);
    if (dn && dn === norm) return d;
  }
  // 3) 包含匹配：画板名包含完整描述（规范化），取最长匹配
  let best = '';
  let bestLen = 0;
  for (let i = 0; i < catalog.length; i++) {
    const c = catalog[i];
    const d = String((c && c.description) || '').trim();
    if (!d) continue;
    const dn = canonicalForMatch(d);
    if (dn && dn.length > bestLen && norm.indexOf(dn) !== -1) {
      best = d;
      bestLen = dn.length;
    }
  }
  return best;
}

function hasVisibleFill(node: any): boolean {
  let fills: any;
  try {
    fills = node.fills;
  } catch (e) {
    return false; // 读取失败 → 默认 PNG
  }
  if (!fills || !Array.isArray(fills) || fills.length === 0) return false; // 无填充 → PNG
  // 仅当存在「可见且非全透明」的填充时才算 JPG。
  // MasterGo 填充字段：isVisible（可见）、alpha（填充透明度）、color.a（纯色透明度）。
  return fills.some((f: any) => {
    if (!f) return false;
    // 可见性（兼容 Figma 的 visible）
    if (f.isVisible === false || f.visible === false) return false;
    // 填充整体透明度（兼容 Figma 的 opacity）
    if (typeof f.alpha === 'number' && f.alpha <= 0) return false;
    if (typeof f.opacity === 'number' && f.opacity <= 0) return false;
    // 纯色填充透明度
    if (f.color && typeof f.color.a === 'number' && f.color.a <= 0) return false;
    return true;
  });
}

/* ============================ 结果 / 选区 ============================ */

function sendResult(level: string, text: string, target = 'attr') {
  sendMsgToUI(MessageType.PLUGIN_RESULT, { level, text, target });
}

function pushSelectionInfo() {
  const selection = (M.document && M.document.currentPage && M.document.currentPage.selection) || [];
  // 统计“通用替换”支持的所有对象：文本图层、实例、母组件、组件集
  const replaceableNodes = selection.filter(
    (node: any) =>
      node && ['TEXT', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET'].indexOf(node.type) !== -1
  );
  sendMsgToUI(MessageType.SELECTION_INFO, {
    count: replaceableNodes.length,
    names: replaceableNodes.map((n: any) => n.name),
    layers: selection.map((n: any) => ({ name: n.name, type: n.type })),
  });
}

/* ============================ 组件属性 / 奖品替换 ============================ */

async function handleApply(targetValues: string[]) {
  const selection = (M.document.currentPage.selection || []) as any[];
  if (selection.length === 0) {
    sendResult('warning', '请先在画布中选择组件实例。');
    return;
  }
  const instances = selection.slice();
  const lines = Array.isArray(targetValues) ? targetValues : [];
  if (!lines.some((l) => (l || '').trim() !== '')) {
    sendResult('warning', '请输入目标属性值：每行一个，按顺序对应每个组件。');
    return;
  }
  let effectiveCount = 0;
  for (let k = 0; k < lines.length; k++) {
    if ((lines[k] || '').trim() !== '') effectiveCount = k + 1;
  }
  const createBriefs: string[] = [];
  if (effectiveCount > instances.length) {
    const template = instances[0];
    const parent = template.parent;
    let cursorX = template.x;
    instances.forEach((n) => {
      cursorX = Math.max(cursorX, n.x + n.width);
    });
    const GAP = 40;
    const need = effectiveCount - instances.length;
    for (let c = 0; c < need; c++) {
      let clone: any;
      try {
        clone = makePrizeInstance(template);
      } catch (e: any) {
        createBriefs.push('补足实例失败：' + String((e && e.message) || e));
        break;
      }
      try {
        if (parent && clone.parent !== parent && typeof parent.appendChild === 'function') {
          parent.appendChild(clone);
        }
        cursorX += GAP;
        clone.x = cursorX;
        clone.y = template.y;
        cursorX += clone.width;
      } catch (e) {}
      instances.push(clone);
    }
  }
  let successCount = 0;
  let updatedCount = 0;
  let skipEmpty = 0;
  let skipNoMatch = 0;
  let failCount = 0;
  const failBriefs: string[] = [];
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i];
    const value = (lines[i] || '').trim();
    if (!value) {
      skipEmpty++;
      failBriefs.push('[' + (i + 1) + '] ' + instance.name + '：跳过（无对应输入）');
      continue;
    }
    let imageDone = false;
    const hit = findVariantMatch(instance, value);
    if (hit) {
      const result = trySwitchVariant(hit.inst, hit.name, value);
      imageDone = result.ok;
    }
    let textDone = false;
    try {
      textDone = await updateNamedText(instance, value);
    } catch (e) {}
    if (imageDone && hit) imageDone = readVariantValue(hit.inst, hit.name) === value;
    if (imageDone || textDone) updatedCount++;
    if (imageDone) {
      successCount++;
      continue;
    }
    let reason: string;
    if (!hit) {
      skipNoMatch++;
      reason = '未找到与“' + value + '”完全匹配的奖品变体';
    } else {
      failCount++;
      const after = readVariantValue(hit.inst, hit.name);
      reason = '目标“' + value + '”，切换后「' + hit.name + '」'
        + (after === undefined ? '无法读取' : '仍为“' + after + '”');
    }
    failBriefs.push(
      '[' + (i + 1) + '] ' + instance.name + '：图片实例替换失败（' + reason + '）'
      + (textDone ? '；仅「奖品名称」文案已更新，图片未替换' : '')
    );
  }
  let extraLines = 0;
  for (let j = instances.length; j < lines.length; j++) {
    if ((lines[j] || '').trim() !== '') extraLines++;
  }
  const hasProblem = skipEmpty > 0 || skipNoMatch > 0 || failCount > 0 || extraLines > 0 || createBriefs.length > 0;
  let summary = '已成功替换 ' + successCount + ' 个奖品图片实例。';
  if (hasProblem) {
    const extras: string[] = [];
    if (skipEmpty > 0) extras.push(skipEmpty + ' 个无对应输入');
    if (skipNoMatch > 0) extras.push(skipNoMatch + ' 个图片实例未匹配到变体');
    if (failCount > 0) extras.push(failCount + ' 个图片实例替换失败');
    if (extraLines > 0) extras.push('忽略多余 ' + extraLines + ' 行');
    if (createBriefs.length > 0) extras.push(createBriefs.length + ' 个补足失败');
    summary += '（' + extras.join('，') + '）';
  }
  const briefs = failBriefs.concat(createBriefs);
  const text = hasProblem ? summary + '\n' + briefs.join('\n') : summary;
  sendResult(hasProblem ? 'error' : 'success', text);
  if (updatedCount > 0 || instances.length > selection.length) {
    try {
      M.document.currentPage.selection = instances;
    } catch (e) {}
    M.commitUndo();
  }
  pushSelectionInfo();
}

/* ============================ H5 一级标替换 ============================ */

function isTitleNodeVisible(node: any): boolean {
  if (!node) return false;
  let current = node;
  while (current) {
    try {
      if (current.isVisible === false || current.visible === false) return false;
      current = current.parent;
    } catch {
      return false;
    }
  }
  return true;
}

function getTitlePropertyTexts(instance: any, key: any): any[] {
  return collectTextNodes(instance).filter((textNode: any) => {
    try {
      const ref = textNode.componentPropertyReferences;
      const charKey = ref && ref.characters;
      if (charKey) return String(charKey) === String(key);
      if ((textNode.name || '').trim() !== '一级标') return false;
      let owner = textNode.parent;
      while (owner && owner.type !== 'INSTANCE') owner = owner.parent;
      return owner === instance;
    } catch {
      return false;
    }
  });
}

function findTitleTextProps(root: any, diag?: string[]): any[] {
  const found: any[] = [];
  const insts = collectInstances(root, []);
  for (let i = 0; i < insts.length; i++) {
    const inst = insts[i];
    if (!isTitleNodeVisible(inst)) continue;
    let cp: any;
    try {
      cp = inst.componentProperties;
    } catch (e) {
      cp = null;
    }
    const entries = normalizeCompProps(cp);
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j];
      if (diag) diag.push('实例[' + inst.name + '] 属性:' + e.name + '(' + e.type + ')');
      if (e.type !== 'TEXT' || e.name !== '一级标') continue;
      const propertyTexts = getTitlePropertyTexts(inst, e.key);
      const visibleTexts = propertyTexts.filter(isTitleNodeVisible);
      if (visibleTexts.length === 0) continue;
      if (visibleTexts.length === propertyTexts.length) {
        found.push({ inst, key: e.key, kind: 'prop' });
      } else {
        visibleTexts.forEach((textNode: any) => {
          found.push({ inst: null, key: null, kind: 'text', textNode });
        });
      }
    }
  }
  if (found.length) return found;
  const texts = collectTextNodes(root);
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!isTitleNodeVisible(t)) continue;
    let ref: any;
    try {
      ref = t.componentPropertyReferences;
    } catch (e) {
      ref = null;
    }
    const charKey = ref && ref.characters;
    const refName = charKey ? stripPropId(charKey) : '';
    if (diag) diag.push('文本[' + t.name + '] 引用:' + (charKey || '无'));
    const nameHit = (t.name || '').trim() === '一级标';
    const refHit = (refName || '').trim() === '一级标';
    if (!nameHit && !refHit) continue;
    let owner: any = null;
    let ownerKey: any = null;
    if (refHit) {
      let node: any = null;
      try {
        node = t.parent;
      } catch (e) {
        node = null;
      }
      while (node) {
        if (node.type === 'INSTANCE') {
          let cp: any;
          try {
            cp = node.componentProperties;
          } catch (e) {
            cp = null;
          }
          const entries = normalizeCompProps(cp);
          const m = entries.filter((e) => e.type === 'TEXT' && e.name === '一级标')[0];
          if (m) {
            owner = node;
            ownerKey = m.key;
            break;
          }
        }
        try {
          node = node.parent;
        } catch (e) {
          node = null;
        }
      }
    }
    const hasHiddenPropertyText = owner
      && getTitlePropertyTexts(owner, ownerKey).some((textNode: any) => !isTitleNodeVisible(textNode));
    if (owner && !hasHiddenPropertyText) found.push({ inst: owner, key: ownerKey, kind: 'prop', textNode: t });
    else found.push({ inst: null, key: null, kind: 'text', textNode: t });
  }
  return found;
}

async function handleTitleReplace(values: string[]) {
  const selection = (M.document.currentPage.selection || []) as any[];
  if (selection.length === 0) {
    sendResult('warning', '请先选中一个组件实例。', 'oneclick');
    return;
  }
  const lines = Array.isArray(values) ? values : [];
  if (!lines.some((l) => (l || '').trim() !== '')) {
    sendResult('warning', '请输入一级标文字。', 'oneclick');
    return;
  }
  let success = 0;
  let lastValue = '';
  const briefs: string[] = [];
  const diag: string[] = [];
  let targets: any[] = [];
  for (let i = 0; i < selection.length; i++) {
    targets = targets.concat(findTitleTextProps(selection[i], diag));
  }
  if (targets.length === 0) {
    let summary = '当前组件中未找到可见的「一级标」文本属性或图层，隐藏图层不参与替换。';
    if (diag.length) {
      const uniq = diag.filter((v, k) => diag.indexOf(v) === k).slice(0, 12);
      summary += '\n—— 诊断 ——\n' + uniq.join('\n');
    }
    sendResult('error', summary, 'oneclick');
    return;
  }
  for (let k = 0; k < targets.length; k++) {
    const value = (lines[k] || '').trim();
    if (!value) continue;
    const hit = targets[k];
    try {
      if (hit.kind === 'prop') hit.inst.setProperties({ [hit.key]: value });
      else await setTextSafe(hit.textNode, value);
      success++;
      lastValue = value;
    } catch (e: any) {
      briefs.push('[' + (k + 1) + ']：替换失败（' + String((e && e.message) || e) + '）');
    }
  }
  let extraLines = 0;
  for (let j = targets.length; j < lines.length; j++) {
    if ((lines[j] || '').trim() !== '') extraLines++;
  }
  const hasProblem = briefs.length > 0 || extraLines > 0;
  let summary: string;
  if (success === 0) {
    summary = '未成功替换任何「一级标」。\n' + briefs.join('\n');
    sendResult('error', summary, 'oneclick');
    return;
  }
  if (success === 1 && !hasProblem) {
    summary = '一级标已更新为“' + lastValue + '”。';
  } else {
    summary = '已更新 ' + success + ' 个一级标（共 ' + targets.length + ' 个）。';
    if (extraLines > 0) summary += '\n忽略多余 ' + extraLines + ' 行输入。';
    if (briefs.length > 0) summary += '\n' + briefs.join('\n');
  }
  sendResult(hasProblem ? 'error' : 'success', summary, 'oneclick');
  M.commitUndo();
}

// 收集单个画板内的可见「一级标」文本：合并「文本属性(引用名=一级标)」与「文本图层(名=一级标)」，
// 按屏幕位置从上到下、从左到右排序，返回每个一级标的当前文本。
function collectTitleTexts(root: any): string[] {
  const texts = collectTextNodes(root);
  const hits: Array<{ value: string; x: number; y: number }> = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!isTitleNodeVisible(t)) continue;
    let ref: any;
    try {
      ref = t.componentPropertyReferences;
    } catch (e) {
      ref = null;
    }
    const charKey = ref && ref.characters;
    const refName = charKey ? stripPropId(charKey) : '';
    const nameHit = (t.name || '').trim() === '一级标';
    const refHit = (refName || '').trim() === '一级标';
    if (!nameHit && !refHit) continue;
    let value = '';
    try {
      if (typeof t.characters === 'string') value = t.characters;
    } catch (e) {
      value = '';
    }
    let x = 0, y = 0;
    try {
      const box = t.absoluteBoundingBox;
      if (box) { x = box.x || 0; y = box.y || 0; }
    } catch (e) {}
    hits.push({ value, x, y });
  }
  // 从上到下、从左到右（同一行内按 x 排序，行容差 8px）
  hits.sort((a, b) => (Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x));
  return hits.map((hit) => hit.value);
}

// 提取命名：读取选中画板中的可见「一级标」文本，按画板顺序、板内位置顺序逐行回填（不改画布/剪贴板）
function handleTitleExtract() {
  const selection = (M.document.currentPage.selection || []) as any[];
  if (selection.length === 0) {
    sendResult('warning', '请先选中画板/组件。', 'oneclick');
    return;
  }
  const lines: string[] = [];
  const unmatched: string[] = [];
  for (let i = 0; i < selection.length; i++) {
    const root = selection[i];
    const values = collectTitleTexts(root);
    if (values.length === 0) {
      unmatched.push((root && root.name) || '对象' + (i + 1));
    } else {
      for (let k = 0; k < values.length; k++) lines.push(values[k]);
    }
  }
  sendMsgToUI(MessageType.TITLE_EXTRACT_RESULT, { lines, unmatched });
}

/* ============================ 通用替换 ============================ */

// 直接选中的普通文本图层：按选中顺序与输入内容逐行对应替换
async function replaceTextLayers(textNodes: any[], prizeNames: string[]) {
  const rawLines = (Array.isArray(prizeNames) ? prizeNames : []).map((s) => (s == null ? '' : String(s)));
  // 去除末尾空行，保留中间行以维持逐行顺序对应
  while (rawLines.length && rawLines[rawLines.length - 1].trim() === '') rawLines.pop();
  if (rawLines.length === 0) {
    sendResult('warning', '请输入替换文本。', 'prize');
    return;
  }
  const pairCount = Math.min(rawLines.length, textNodes.length);
  let replaced = 0;
  const fails: string[] = [];
  for (let i = 0; i < pairCount; i++) {
    const value = rawLines[i].trim();
    // 空行跳过，保持后续行与文本图层的顺序对应关系
    if (value === '') continue;
    try {
      await setTextSafe(textNodes[i], value);
      replaced++;
    } catch (e: any) {
      fails.push('[' + (i + 1) + '] ' + value + '：替换失败（' + String((e && e.message) || e) + '）');
    }
  }
  const notes: string[] = [];
  if (rawLines.length > textNodes.length) {
    notes.push('有 ' + (rawLines.length - textNodes.length) + ' 行文本多余（选中文本图层不足）。');
  } else if (textNodes.length > rawLines.length) {
    notes.push('有 ' + (textNodes.length - rawLines.length) + ' 个文本图层未获得内容（文本行数不足）。');
  }
  const hasProblem = fails.length > 0 || notes.length > 0;
  if (replaced === 0 && !hasProblem) {
    sendResult('warning', '没有文本被替换。', 'prize');
    return;
  }
  let summary = '已替换 ' + replaced + ' 个文本图层。';
  if (notes.length) summary += '\n' + notes.join('\n');
  if (fails.length) summary += '\n' + fails.join('\n');
  sendResult(hasProblem ? 'error' : 'success', summary, 'prize');
  if (replaced > 0) M.commitUndo();
}

// 直接选中的组件实例：不新建实例，按选中顺序与输入内容逐行对应，原地替换实例文本
async function replaceInstancesInPlace(
  instances: any[],
  prizeNames: string[],
  scope?: string,
  propName?: string
) {
  const lines = (Array.isArray(prizeNames) ? prizeNames : []).map((s) => (s || '').trim()).filter((s) => s !== '');
  if (lines.length === 0) {
    sendResult('warning', '请先填写替换内容。', 'prize');
    return;
  }
  const pairCount = Math.min(lines.length, instances.length);
  let replaced = 0;
  const fails: string[] = [];
  for (let i = 0; i < pairCount; i++) {
    const name = lines[i];
    try {
      const err = await applyPrizeToInstance(instances[i], name, scope, propName);
      if (err) fails.push('[' + (i + 1) + '] ' + name + '：' + err);
      else replaced++;
    } catch (e: any) {
      fails.push('[' + (i + 1) + '] ' + name + '：替换失败（' + String((e && e.message) || e) + '）');
    }
  }
  const notes: string[] = [];
  if (instances.length > lines.length) {
    notes.push('有 ' + (instances.length - lines.length) + ' 个实例未替换，原因是输入内容不足。');
  } else if (lines.length > instances.length) {
    notes.push('有 ' + (lines.length - instances.length) + ' 行输入内容未使用。');
  }
  const hasProblem = fails.length > 0 || notes.length > 0;
  if (replaced === 0 && !hasProblem) {
    sendResult('warning', '没有实例被替换。', 'prize');
    return;
  }
  let summary = '已替换 ' + replaced + ' 个实例。';
  if (notes.length) summary += '\n' + notes.join('\n');
  if (fails.length) summary += '\n' + fails.join('\n');
  sendResult(hasProblem ? 'error' : 'success', summary, 'prize');
  if (replaced > 0) M.commitUndo();
}

async function handlePrizeGenerate(prizeNames: string[], scope?: string, propName?: string) {
  const selection = (M.document.currentPage.selection || []) as any[];

  const textNodes = selection.filter((n) => n && n.type === 'TEXT');
  const components = selection.filter(
    (n) => n && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET')
  );
  const instances = selection.filter((n) => n && n.type === 'INSTANCE');

  // 一、选中普通文本图层（既无组件也无实例）：逐行顺序替换文本图层内容
  if (scope !== 'variant' && textNodes.length > 0 && components.length === 0 && instances.length === 0) {
    await replaceTextLayers(textNodes, prizeNames);
    return;
  }

  // 二、选中组件实例（且未选中母组件/组件集）：直接修改选中实例文本，不新建实例
  if (instances.length > 0 && components.length === 0) {
    await replaceInstancesInPlace(instances, prizeNames, scope, propName);
    return;
  }

  // 三、选中母组件 / 组件集：不改动原组件，按输入逐行生成新实例
  const tpl = components[0];
  if (!tpl) {
    sendResult('warning', '请先选中一个组件（母组件或实例），或选中要替换的文本图层。', 'prize');
    return;
  }
  const lines = (Array.isArray(prizeNames) ? prizeNames : []).map((s) => (s || '').trim()).filter((s) => s !== '');
  if (lines.length === 0) {
    sendResult('warning', '请先填写替换内容。', 'prize');
    return;
  }
  const GAP = 40;
  const parent = tpl.parent;
  const created: any[] = [];
  const fails: string[] = [];
  let cursorX = tpl.x + tpl.width + GAP;
  for (let i = 0; i < lines.length; i++) {
    const name = lines[i];
    let clone: any;
    try {
      clone = makePrizeInstance(tpl);
    } catch (e: any) {
      fails.push('[' + (i + 1) + '] ' + name + '：创建实例失败（' + String((e && e.message) || e) + '）');
      continue;
    }
    try {
      if (parent && clone.parent !== parent && typeof parent.appendChild === 'function') parent.appendChild(clone);
      clone.x = cursorX;
      clone.y = tpl.y;
      cursorX += clone.width + GAP;
    } catch (e) {}
    try {
      clone.name = name;
    } catch (e) {}
    const err = await applyPrizeToInstance(clone, name, scope, propName);
    if (err) fails.push('[' + (i + 1) + '] ' + name + '：' + err);
    else created.push(clone);
  }
  if (created.length > 0) {
    try {
      M.document.currentPage.selection = created;
    } catch (e) {}
    M.commitUndo();
  }
  if (fails.length === 0) {
    sendResult('success', '已生成 ' + created.length + ' 个实例。', 'prize');
  } else {
    const head = created.length > 0 ? '已生成 ' + created.length + ' 个，' + fails.length + ' 个失败：\n' : '生成失败：\n';
    sendResult('error', head + fails.join('\n'), 'prize');
  }
}

function handleRenameLayers(values: string[]) {
  const selection = (M.document.currentPage.selection || []) as any[];
  if (selection.length === 0) {
    sendResult('warning', '请先选中要改名的实例。', 'common');
    return;
  }
  const raw = Array.isArray(values) ? values : [];
  const names = raw.map((s) => (s || '').trim()).filter((s) => s !== '');
  if (names.length === 0) {
    sendResult('warning', '请输入图层名称。', 'common');
    return;
  }
  const pairCount = Math.min(names.length, selection.length);
  let renamed = 0;
  const fails: string[] = [];
  for (let i = 0; i < pairCount; i++) {
    try {
      selection[i].name = names[i];
      renamed++;
    } catch (e: any) {
      fails.push('[' + (i + 1) + '] ' + names[i] + '：改名失败（' + String((e && e.message) || e) + '）');
    }
  }
  const notes: string[] = [];
  if (names.length > selection.length) notes.push('有 ' + (names.length - selection.length) + ' 行文本多余（选中实例不足）。');
  else if (selection.length > names.length) notes.push('有 ' + (selection.length - names.length) + ' 个实例未获得名称（文本行数不足）。');
  const hasProblem = fails.length > 0 || notes.length > 0;
  let summary = '已重命名 ' + renamed + ' 个图层。';
  if (notes.length) summary += '\n' + notes.join('\n');
  if (fails.length) summary += '\n' + fails.join('\n');
  sendResult(hasProblem ? 'error' : 'success', summary, 'common');
  if (renamed > 0) M.commitUndo();
}

/* ============================ 统一命名 ============================ */

function handleRename(categories: string[], mapping: any) {
  const selection = (M.document.currentPage.selection || []) as any[];
  if (selection.length === 0) {
    sendResult('warning', '请先在画布中选择图层。', 'rename');
    return;
  }
  const map = mapping || {};
  if (Object.keys(map).length === 0) {
    sendResult('warning', '请为需要修改的分组填写新名称。', 'rename');
    return;
  }
  let changed = 0;
  const failBriefs: string[] = [];
  selection.forEach((node) => {
    if (!matchAnyCategory(node, categories)) return;
    const oldName = node.name;
    if (!Object.prototype.hasOwnProperty.call(map, oldName)) return;
    const newName = map[oldName];
    if (!newName || newName === oldName) return;
    try {
      node.name = newName;
      changed++;
    } catch (e) {
      failBriefs.push(oldName + ' → ' + newName + '：失败（' + String(e) + '）');
    }
  });
  const hasProblem = failBriefs.length > 0;
  let summary = '已成功重命名 ' + changed + ' 个图层。';
  if (changed === 0 && !hasProblem) {
    sendResult('warning', '没有图层被重命名（可能新名称与原名相同或选择已变化）。', 'rename');
    return;
  }
  const text = hasProblem ? summary + '（' + failBriefs.length + ' 个失败）\n' + failBriefs.join('\n') : summary;
  sendResult(hasProblem ? 'error' : 'success', text, 'rename');
  if (changed > 0) M.commitUndo();
  pushSelectionInfo();
}

/* ============================ 资源位导出（扫描）+ 隐藏规范 ============================ */

type DescriptionSource = 'native' | 'plugin' | 'match' | 'none';

// 组件描述读取优先级：原生描述 → 插件隐藏字段 → 名称匹配组件库；原生/匹配命中后回写隐藏字段
function resolveComponentDescription(node: any): { componentDescription: string; descriptionSource: DescriptionSource } {
  let desc = '';
  let source: DescriptionSource = 'none';
  try {
    desc = node && typeof node.description === 'string' ? node.description.trim() : '';
    if (desc) source = 'native';
  } catch (e) {
    desc = '';
  }
  if (!desc) {
    try {
      desc = typeof node.getPluginData === 'function' ? String(node.getPluginData('componentDescription') || '').trim() : '';
      if (desc) source = 'plugin';
    } catch (e) {
      desc = '';
    }
  }
  if (!desc) {
    try {
      desc = matchCatalogDescription(node.name) || '';
      if (desc) source = 'match';
    } catch (e) {
      desc = '';
    }
  }
  if (desc && source !== 'plugin') {
    try {
      if (typeof node.setPluginData === 'function') node.setPluginData('componentDescription', desc);
    } catch (e) {
      // ignore
    }
  }
  return { componentDescription: desc, descriptionSource: source };
}

function handleChannelScanStart() {
  const total = (M.document.currentPage.selection || []).length;
  const pageName = (M.document && M.document.currentPage && M.document.currentPage.name) || '';
  sendMsgToUI(MessageType.CHANNEL_SCAN_READY, { total, pageName });
}

async function handleChannelScanOne(index: number) {
  const selection = (M.document.currentPage.selection || []) as any[];
  const total = selection.length;
  if (index < 0 || index >= total) {
    sendMsgToUI(MessageType.CHANNEL_SCAN_ITEM, { index, total });
    return;
  }
  const node = selection[index];
  let item: any = null;
  let fail: any = null;
  try {
    const bytes = await node.exportAsync({ format: 'PNG' });
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    // 单张导出直接下载，不参与组件描述读取/匹配/分类
    const { componentDescription, descriptionSource } =
      total > 1 ? resolveComponentDescription(node) : { componentDescription: '', descriptionSource: 'none' };

    item = {
      name: node.name,
      width: Math.round(node.width),
      height: Math.round(node.height),
      size: buf.length,
      format: hasVisibleFill(node) ? 'JPG' : 'PNG',
      componentDescription,
      descriptionSource,
      buf,
    };
  } catch (e: any) {
    fail = node.name + '：导出失败（' + String((e && e.message) || e) + '）';
  }
  sendMsgToUI(MessageType.CHANNEL_SCAN_ITEM, { index, total, item, fail });
}

/* ============================ 注册 ============================ */

// 选区变化时刷新（附加监听，不影响 Variant 既有 selectionchange）
try {
  M.on('selectionchange', () => pushSelectionInfo());
} catch (e) {}

export default [
  { type: MessageType.APPLY as any, handler: (d: any) => handleApply((d && d.targetValues) || []) },
  { type: MessageType.RENAME as any, handler: (d: any) => handleRename((d && d.categories) || [], (d && d.mapping) || {}) },
  { type: MessageType.PRIZE_GENERATE as any, handler: (d: any) => handlePrizeGenerate((d && d.prizeNames) || [], d && d.scope, d && d.propName) },
  { type: MessageType.RENAME_LAYERS as any, handler: (d: any) => handleRenameLayers((d && d.values) || []) },
  { type: MessageType.TITLE_REPLACE as any, handler: (d: any) => handleTitleReplace((d && d.values) || []) },
  { type: MessageType.TITLE_EXTRACT as any, handler: () => handleTitleExtract() },
  { type: MessageType.CHANNEL_SCAN_START as any, handler: () => handleChannelScanStart() },
  { type: MessageType.CHANNEL_SCAN_ONE as any, handler: (d: any) => handleChannelScanOne(d && d.index) },
  { type: MessageType.SELECTION_INFO_REQ as any, handler: () => pushSelectionInfo() },
];
