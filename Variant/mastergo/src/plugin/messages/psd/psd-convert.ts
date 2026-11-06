// @ts-nocheck
/**
 * PSD 转换（主线程）
 * 由独立插件 psd-2-mastergo 的 main.js 迁移而来，逻辑保持不变：
 * - 去掉独立的 mg.showUI / mg.ui.onmessage，改为接入本插件的消息通道（PSD_TO_PLUGIN / PSD_TO_UI）；
 * - 界面侧消息原样转发，类型字符串（init / begin / layer / export-psd / organize-* 等）沿用原协议。
 */
import { MessageType, sendMsgToUI } from '../../../../../src/messages';

const psdUi = {
  postMessage: (payload) => sendMsgToUI(MessageType.PSD_TO_UI, payload)
};
let psdOnMessage = null;

(function() {
	/**
	 * MasterGo 的 viewport 只提供 center/zoom/bounds，没有 scrollAndZoomIntoView。
	 * 这里按节点包围盒把视窗中心移到目标位置（几何计算替代原 API）。
	 * @param nodes 需要居中的节点数组
	 */
	function scrollAndZoomIntoView(nodes) {
		var list = (nodes || []).filter(Boolean);
		if (!list.length) return;
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		list.forEach(function (n) {
			var b = n.absoluteBoundingBox || n.bound;
			if (!b) return;
			minX = Math.min(minX, b.x);
			minY = Math.min(minY, b.y);
			maxX = Math.max(maxX, b.x + b.width);
			maxY = Math.max(maxY, b.y + b.height);
		});
		if (!isFinite(minX)) return;
		mg.viewport.center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
	}
	//#region src/text-scale.ts
	/** Bake uniform vertical scale into typography while retaining residual affine geometry. */
	function bakeTextScale(text) {
		const matrix = text.matrix;
		if (!matrix || matrix.length !== 6) return;
		const scale = Math.hypot(matrix[2], matrix[3]);
		if (!Number.isFinite(scale) || scale < 1e-8 || Math.abs(scale - 1) < 1e-8) return;
		text.runs = text.runs.map((run) => ({
			...run,
			style: {
				...run.style,
				size: run.style.size * scale,
				leading: run.style.leading === void 0 ? void 0 : run.style.leading * scale
			}
		}));
		text.localX *= scale;
		text.localY *= scale;
		text.width *= scale;
		text.paragraphs = text.paragraphs?.map((p) => ({
			...p,
			spaceBefore: p.spaceBefore * scale,
			spaceAfter: p.spaceAfter * scale
		}));
		text.matrix = matrix.map((value, i) => i < 4 ? value / scale : value);
	}
	//#endregion
	//#region src/organizer-alpha.ts
	var sequence = 0;
	var pending = /* @__PURE__ */ new Map();
	function receiveAlpha(message) {
		const p = pending.get(message.token);
		if (!p) return;
		clearTimeout(p.timer);
		pending.delete(message.token);
		p.resolve(["disjoint", "overlap"].includes(message.result) ? message.result : "unknown");
	}
	function compareAlpha(a, b) {
		const token = "alpha-" + ++sequence;
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				pending.delete(token);
				resolve("unknown");
			}, 1e4);
			pending.set(token, {
				resolve,
				timer
			});
			psdUi.postMessage({
				type: "organize-alpha",
				token,
				a,
				b
			});
		});
	}
	//#endregion
	//#region src/organize-model.ts
	var overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
	function recognize(input, region) {
		const result = input.map((c) => ({
			...c,
			box: { ...c.box },
			row: 0,
			category: "review"
		}));
		const inside = result.filter((c) => {
			const a = c.box.width * c.box.height;
			if (!c.safe) {
				c.reason = c.reason || "包含蒙版、效果或混合关系，保留原结构";
				return false;
			}
			if (!a || overlap(c.box, region) / a < .9 || c.box.width > region.width * 1.05 || c.box.height > region.height * .65 || a > region.width * region.height * .7) {
				c.category = "outside";
				c.reason = "跨区域或共享背景，保留外层";
				return false;
			}
			return true;
		});
		const families = inside.map((seed) => {
			const peers = inside.filter((c) => Math.abs(c.box.width - seed.box.width) <= seed.box.width * .12 && Math.abs(c.box.height - seed.box.height) <= seed.box.height * .12);
			const cells = [];
			for (const c of peers) if (!cells.some((b) => overlap(b, c.box) > .5 * Math.min(b.width * b.height, c.box.width * c.box.height))) cells.push(c.box);
			return {
				cells,
				area: seed.box.width * seed.box.height
			};
		}).filter((f) => f.cells.length >= 2);
		families.sort((a, b) => b.area - a.area);
		const anchors = families[0]?.cells ?? [];
		anchors.sort((a, b) => Math.abs(a.y - b.y) < Math.min(a.height, b.height) * .45 ? a.x - b.x : a.y - b.y);
		for (const c of inside) {
			const area = c.box.width * c.box.height;
			const matches = anchors.map((b, i) => ({
				i,
				coverage: overlap(c.box, b) / area
			})).filter((m) => m.coverage >= .9);
			if (matches.length !== 1) {
				c.reason = anchors.length ? "跨格子或缺少可靠边界，请手动确认分组" : "未找到重复格子边界，请手动分配图层";
				continue;
			}
			c.row = matches[0].i + 1;
			c.category = "item";
			c.reason = c.reason ? c.reason + "；按二维格子边界归属" : "按二维格子边界归属";
		}
		return result;
	}
	function boundsOf(boxes) {
		const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
		return {
			x,
			y,
			width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
			height: Math.max(...boxes.map((b) => b.y + b.height)) - y
		};
	}
	//#endregion
	//#region src/organizer-stack.ts
	var unit = (c, common = false) => c.row ? common ? "list" : "g:" + c.row : "n:" + c.id;
	var pairKey = (a, b) => [a, b].sort().join("|");
	function arrange(layers, disjoint = /* @__PURE__ */ new Set(), common = false) {
		const sorted = [...layers].sort((a, b) => a.order - b.order), rank = /* @__PURE__ */ new Map(), edges = [], seen = /* @__PURE__ */ new Set();
		for (const c of sorted) {
			const u = unit(c, common);
			if (!rank.has(u)) rank.set(u, c.order);
		}
		function edge(a, b, kind) {
			const from = unit(a, common), to = unit(b, common), key = from + ">" + to;
			if (from === to || seen.has(key)) return;
			seen.add(key);
			edges.push({
				from,
				to,
				lower: a.id,
				upper: b.id,
				kind
			});
		}
		let previous;
		for (const c of sorted) if (!c.row) {
			if (previous) edge(previous, c, "retained-order");
			previous = c;
		}
		for (const a of sorted) {
			if (!a.row || a.effectiveVisible === false) continue;
			for (const b of sorted) {
				if (b.row && b.order <= a.order || unit(a, common) === unit(b, common) || b.effectiveVisible === false) continue;
				if (overlap(a.box, b.box) > 0 && !disjoint.has(pairKey(a.id, b.id))) {
					if (a.order < b.order) edge(a, b, "overlap");
					else edge(b, a, "overlap");
				}
			}
		}
		const outgoing = /* @__PURE__ */ new Map(), degree = new Map([...rank.keys()].map((k) => [k, 0]));
		for (const e of edges) {
			const list = outgoing.get(e.from) ?? [];
			list.push(e);
			outgoing.set(e.from, list);
			degree.set(e.to, degree.get(e.to) + 1);
		}
		const ready = [...rank.keys()].filter((k) => !degree.get(k)), order = [];
		while (ready.length) {
			ready.sort((a, b) => rank.get(b) - rank.get(a));
			const u = ready.pop();
			order.push(u);
			for (const e of outgoing.get(u) ?? []) {
				degree.set(e.to, degree.get(e.to) - 1);
				if (!degree.get(e.to)) ready.push(e.to);
			}
		}
		if (order.length === rank.size) return {
			order,
			cycle: [],
			edges
		};
		const state = /* @__PURE__ */ new Map();
		let cycle = [];
		for (const start of rank.keys()) {
			if (state.has(start)) continue;
			const stack = [{
				id: start,
				index: 0
			}];
			state.set(start, 1);
			while (stack.length && !cycle.length) {
				const top = stack[stack.length - 1], next = (outgoing.get(top.id) ?? [])[top.index++];
				if (!next) {
					state.set(top.id, 2);
					stack.pop();
					continue;
				}
				if (state.get(next.to) === 1) {
					const index = stack.findIndex((s) => s.id === next.to);
					cycle = [...stack.slice(index + 1).map((s) => s.via), next];
					break;
				}
				if (!state.has(next.to)) {
					state.set(next.to, 1);
					stack.push({
						id: next.to,
						index: 0,
						via: next
					});
				}
			}
			if (cycle.length) break;
		}
		return {
			order,
			cycle,
			edges
		};
	}
	//#endregion
	//#region src/organizer-plan.ts
	var emptyPlan = (owner) => ({
		version: 1,
		owner,
		revision: 0,
		nextId: 1,
		groups: [],
		records: []
	});
	function uniqueName(plan, name, except) {
		const value = String(name ?? "").trim();
		if (!value || value.length > 80) throw Error("请输入 1–80 字的分组名称。");
		if (plan.groups.some((g) => g.id !== except && g.name === value)) throw Error("该分组名称已存在，请使用其他名称。");
		return value;
	}
	function createGroup(plan, name) {
		if (plan.groups.length >= 1e3) throw Error("分组数量已达 1000，请拆分整理方案。");
		const group = {
			id: plan.nextId++,
			name: uniqueName(plan, name)
		};
		plan.groups.push(group);
		return group;
	}
	function mergeScan(plan, items) {
		const records = new Map(plan.records.map((c) => [c.id, c]));
		for (const c of items) {
			const old = records.get(c.id);
			records.set(c.id, {
				...c,
				group: old?.group ?? null
			});
		}
		if (records.size > 1e4) throw Error("方案已记录超过 10000 个图层，请分设计整理。");
		plan.records = [...records.values()];
	}
	function refreshPlan(plan, current) {
		const available = new Map(current.map((c) => [c.id, c]));
		plan.records = plan.records.map((c) => {
			const live = available.get(c.id);
			return live ? {
				...live,
				group: c.group
			} : {
				...c,
				invalid: "来源已失效：图层已删除、移出设计或层级不再允许单独处理"
			};
		});
	}
	function assignGroup(plan, ids, group) {
		if (group !== 0 && !plan.groups.some((g) => g.id === group)) throw Error("目标分组不存在。");
		const members = ids.map((id) => plan.records.find((c) => c.id === id));
		if (!members.length || members.some((c) => !c)) throw Error("请先选择有效图层。");
		for (const c of members) if (group > 0 && (c.invalid || !c.safe)) throw Error("「" + c.name + "」不能加入分组：" + (c.invalid || c.reason));
		for (const c of members) c.group = group;
	}
	var KEY = "organizer-plan-v1";
	function readPlan(root) {
		const raw = root.getPluginData(KEY);
		if (!raw) return emptyPlan(root.id);
		try {
			const meta = JSON.parse(raw);
			if (meta.owner !== root.id) return emptyPlan(root.id);
			if (!Number.isInteger(meta.count) || meta.count < 1 || meta.count > 2e3 || ![0, 1].includes(meta.slot)) throw Error();
			let data = "";
			for (let i = 0; i < meta.count; i++) data += root.getPluginData(KEY + "-" + meta.slot + "-" + i);
			const plan = JSON.parse(data);
			if (plan.version !== 1 || plan.owner !== root.id || !Array.isArray(plan.groups) || !Array.isArray(plan.records) || !Number.isInteger(plan.nextId)) throw Error();
			if (!Number.isInteger(plan.revision) || plan.revision < 0 || plan.groups.length > 1e3 || plan.records.length > 1e4) throw Error();
			const groups = /* @__PURE__ */ new Set(), names = /* @__PURE__ */ new Set(), records = /* @__PURE__ */ new Set();
			for (const g of plan.groups) {
				if (!Number.isInteger(g.id) || g.id <= 0 || groups.has(g.id) || typeof g.name !== "string" || !g.name.trim() || g.name.length > 80 || names.has(g.name)) throw Error();
				groups.add(g.id);
				names.add(g.name);
			}
			if (plan.nextId <= Math.max(0, ...groups)) throw Error();
			for (const r of plan.records) {
				if (typeof r.id !== "string" || records.has(r.id) || typeof r.name !== "string" || !r.box || ![
					r.box.x,
					r.box.y,
					r.box.width,
					r.box.height
				].every(Number.isFinite) || r.group !== null && r.group !== 0 && !groups.has(r.group)) throw Error();
				records.add(r.id);
			}
			return plan;
		} catch {
			throw Error("整理方案读取失败，原数据未覆盖。请恢复文档版本或联系开发者。");
		}
	}
	function savePlan(root, plan) {
		const old = root.getPluginData(KEY);
		let previous;
		try {
			previous = old ? JSON.parse(old) : void 0;
		} catch {}
		const slot = previous?.slot === 0 ? 1 : 0, parts = JSON.stringify(plan).match(/[\s\S]{1,16000}/gu) ?? [""];
		for (let i = 0; i < parts.length; i++) root.setPluginData(KEY + "-" + slot + "-" + i, parts[i]);
		root.setPluginData(KEY, JSON.stringify({
			owner: root.id,
			slot,
			count: parts.length
		}));
		if (previous && Number.isInteger(previous.count) && previous.count <= 2e3) for (let i = 0; i < previous.count; i++) try {
			root.setPluginData(KEY + "-" + previous.slot + "-" + i, "");
		} catch {
			break;
		}
	}
	function clearCopiedPlan(root) {
		const raw = root.getPluginData(KEY);
		if (raw) try {
			const m = JSON.parse(raw);
			for (let i = 0; i < Math.min(m.count, 2e3); i++) root.setPluginData(KEY + "-" + m.slot + "-" + i, "");
		} catch {}
		root.setPluginData(KEY, "");
	}
	//#endregion
	//#region src/organizer.ts
	var source;
	var range;
	var plan;
	var diagnosis;
	var alphaStamp = "";
	var alphaPixels = 0;
	var exportsCache = /* @__PURE__ */ new Map();
	var alphaPairs = /* @__PURE__ */ new Map();
	function existingTemporary(root) {
		return root.parent && "children" in root.parent ? root.parent.children.find((n) => n.getPluginData("organizer-temp-owner") === root.id) : void 0;
	}
	function effectiveVisible(n) {
		let node = n;
		while (node && "isVisible" in node) {
			if (!node.isVisible || "opacity" in node && node.opacity === 0) return false;
			node = node.parent;
		}
		return true;
	}
	function alphaEligible(n) {
		if (![
			"FRAME",
			"GROUP",
			"RECTANGLE",
			"ELLIPSE",
			"VECTOR",
			"TEXT",
			"BOOLEAN_OPERATION",
			"POLYGON",
			"STAR",
			"LINE"
		].includes(n.type) || !axis(n) || siblingMask(n) || externalReason(n)) return false;
		function local(node) {
			if ("effects" in node && node.effects.some((e) => e.isVisible !== false)) return false;
			if ("strokes" in node && Array.isArray(node.strokes) && node.strokes.some((p) => p.isVisible !== false)) return false;
			if ("blendMode" in node && !["NORMAL", "PASS_THROUGH"].includes(node.blendMode)) return false;
			if ("fills" in node && Array.isArray(node.fills) && node.fills.some((p) => p.isVisible !== false && p.blendMode && !["NORMAL", "PASS_THROUGH"].includes(p.blendMode))) return false;
			return !("children" in node) || node.children.every(local);
		}
		return local(n);
	}
	async function exportAlpha(id) {
		if (exportsCache.has(id)) return exportsCache.get(id);
		const node = await mg.getNodeById(id);
		let value = null;
		if (node && "isVisible" in node && "exportAsync" in node && alphaEligible(node)) {
			const b = node.absoluteBoundingBox;
			if (b && [
				b.x,
				b.y,
				b.width,
				b.height
			].every(Number.isInteger) && b.width > 0 && b.height > 0 && b.width <= 8192 && b.height <= 8192 && b.width * b.height <= 16e6 && alphaPixels + b.width * b.height <= 216e6) {
				alphaPixels += b.width * b.height;
				try {
					value = {
						bytes: await node.exportAsync({
							format: "PNG",
							constraint: {
								type: "SCALE",
								value: 1
							},
							useAbsoluteBounds: true
						}),
						box: { ...b }
					};
				} catch {}
			}
		}
		exportsCache.set(id, value);
		return value;
	}
	async function diagnoseStack(root, items) {
		const stamp = signature(root);
		if (stamp !== alphaStamp) {
			alphaStamp = stamp;
			alphaPixels = 0;
			exportsCache.clear();
			alphaPairs.clear();
		}
		const disjoint = new Set([...alphaPairs].filter(([, value]) => value === "disjoint").map(([key]) => key));
		let graph = arrange(items, disjoint), common = arrange(items, disjoint, true), attempts = 0;
		while (attempts < 24) {
			const edge = (graph.cycle.length ? graph.cycle : common.cycle).find((e) => e.kind === "overlap" && !alphaPairs.has(pairKey(e.lower, e.upper)));
			if (!edge) break;
			const key = pairKey(edge.lower, edge.upper), a = await exportAlpha(edge.lower), b = await exportAlpha(edge.upper);
			attempts++;
			psdUi.postMessage({
				type: "organize-progress",
				message: "正在核对透明区域（" + attempts + " 组）…"
			});
			const result = a && b ? await compareAlpha(a, b) : "unknown";
			alphaPairs.set(key, result);
			if (result === "disjoint") disjoint.add(key);
			if (signature(root) !== stamp) throw Error("检测期间原设计发生变化，请重新检查。");
			graph = arrange(items, disjoint);
			common = arrange(items, disjoint, true);
		}
		return {
			graph,
			common,
			stamp,
			disjoint
		};
	}
	var preview;
	async function restoreRange(root) {
		const id = root.getPluginData("organizer-range-id");
		const n = id ? await mg.getNodeById(id) : null;
		range = n?.type === "RECTANGLE" && n.getPluginData("organizer-owner") === root.id ? n : void 0;
	}
	function rangeChanged() {
		return !range || range.removed || !axis(range) || JSON.stringify(range.absoluteBoundingBox) !== JSON.stringify(preview?.region);
	}
	var send = (data) => psdUi.postMessage({
		type: "organize-result",
		...data
	});
	function axis(n) {
		const t = n.absoluteTransform;
		return Math.abs(t[0][0] - 1) < 1e-5 && Math.abs(t[1][1] - 1) < 1e-5 && Math.abs(t[0][1]) < 1e-5 && Math.abs(t[1][0]) < 1e-5;
	}
	function safeContainer(n) {
		return (n.type === "FRAME" || n.type === "GROUP") && n.opacity === 1 && !n.isMask && (n.blendMode === "PASS_THROUGH" || n.blendMode === "NORMAL") && n.effects.length === 0 && (!("fills" in n) || Array.isArray(n.fills) && n.fills.length === 0) && (!("clipsContent" in n) || !n.clipsContent) && n.children.every((c) => !("isMask" in c) || !c.isMask) && axis(n) && n.blendMode === "PASS_THROUGH";
	}
	function externalReason(n) {
		if ("effects" in n && n.effects.some((e) => e.isVisible !== false && e.type === "BACKGROUND_BLUR")) return "背景模糊依赖后方图层，暂不移动";
		const blend = "blendMode" in n ? n.blendMode : "NORMAL";
		if (blend !== "NORMAL" && blend !== "PASS_THROUGH") return "混合模式 " + blend + " 依赖外部背景，暂不移动";
		if (blend === "PASS_THROUGH" && "children" in n) for (const c of n.children) {
			const reason = externalReason(c);
			if (reason) return "组内「" + c.name + "」：" + reason;
		}
		return "";
	}
	function siblingMask(n) {
		return !!n.parent && "children" in n.parent && n.parent.children.some((c) => "isMask" in c && c.isMask);
	}
	function expandable(n) {
		return n.isVisible && !siblingMask(n) && "children" in n && safeContainer(n) && (!n.getPluginData("psd-source") || n.children.some((c) => !!c.getPluginData("psd-source")));
	}
	function collect(root, region) {
		const all = [];
		let order = 0;
		function visit(n, canMove) {
			const box = ("absoluteRenderBounds" in n ? n.absoluteRenderBounds : null) ?? n.absoluteBoundingBox;
			if (!box) return;
			n.getPluginData("psd-source");
			const structural = "children" in n && n.children.some((c) => !!c.getPluginData("psd-source"));
			if (n.type === "FRAME" && axis(n) && n.isVisible && n.children.length >= 2 && "isMask" in n.children[0] && n.children[0].isMask && n.children.slice(1).every((c) => !("isMask" in c) || !c.isMask)) {
				const content = n.children.length === 2 && n.children[1].type === "FRAME" && !n.children[1].getPluginData("psd-source") ? n.children[1] : n;
				if (content.type === "FRAME" && axis(content)) {
					for (const child of content.children) {
						if ("isMask" in child && child.isMask) continue;
						const b = ("absoluteRenderBounds" in child ? child.absoluteRenderBounds : null) ?? child.absoluteBoundingBox;
						if (!b) continue;
						const index = order++;
						if (region && !overlap(b, region)) continue;
						const reason = externalReason(child);
						all.push({
							id: child.id,
							name: child.name,
							box: { ...b },
							order: index,
							row: 0,
							category: "review",
							visible: child.isVisible,
							effectiveVisible: effectiveVisible(child),
							safe: !reason,
							scopeId: content.id,
							scopeName: n.name,
							reason: reason || "受父级「" + n.name + "」蒙版影响，生成时保留原蒙版结构"
						});
					}
					return;
				}
			}
			if ("children" in n && expandable(n)) {
				for (const c of n.children) visit(c, canMove);
				return;
			}
			const index = order++;
			if (region && !overlap(box, region)) return;
			const reason = "isMask" in n && n.isMask ? "此蒙版作用于同级图层，不能单独移动" : siblingMask(n) ? "同级存在蒙版，单独移动可能改变蒙版作用范围" : externalReason(n);
			const safe = canMove && !reason;
			all.push({
				effectiveVisible: effectiveVisible(n),
				visible: n.isVisible,
				id: n.id,
				name: n.name,
				box: { ...box },
				safe,
				reason: reason || (structural ? "可整体移动，保留内部图层、蒙版与效果" : "可整体移动，保留现有属性"),
				order: index,
				row: 0,
				category: "review"
			});
		}
		for (const c of root.children) visit(c, true);
		return all;
	}
	function signature(root, visibility = /* @__PURE__ */ new Map()) {
		const result = [];
		function walk(n) {
			result.push([
				n.id,
				n.name,
				visibility.has(n.id) ? visibility.get(n.id).current === n.isVisible ? visibility.get(n.id).original : ["external-visibility", n.isVisible] : n.isVisible,
				n.absoluteTransform,
				n.width,
				n.height,
				"opacity" in n ? n.opacity : null,
				"blendMode" in n ? n.blendMode : null,
				"fills" in n ? n.fills : null,
				"effects" in n ? n.effects : null,
				"isMask" in n ? n.isMask : null,
				"strokes" in n ? n.strokes : null,
				"strokeWeight" in n ? n.strokeWeight : null,
				"penPaths" in n ? n.penPaths : null,
				n.type === "TEXT" ? [
					n.characters,
					((n.textStyles && n.textStyles[0] && n.textStyles[0].textStyle) ? n.textStyles[0].textStyle.fontName : null),
					((n.textStyles && n.textStyles[0] && n.textStyles[0].textStyle) ? n.textStyles[0].textStyle.fontSize : null),
					typeof n.getStyledTextSegments === "function" ? n.getStyledTextSegments([
						"fontName",
						"fontSize",
						"fills",
						"lineHeight",
						"letterSpacing",
						"textDecoration"
					]) : null
				] : null
			]);
			if ("children" in n) for (const c of n.children) walk(c);
		}
		function properties(n) {
			const keys = [
				"clipsContent",
				"cornerRadius",
				"topLeftRadius",
				"topRightRadius",
				"bottomLeftRadius",
				"bottomRightRadius",
				"cornerSmoothing",
				"maskType",
				"isMaskOutline",
				"strokeAlign",
				"strokeCap",
				"strokeJoin",
				"strokeMiterLimit",
				"dashPattern",
				"strokeTopWeight",
				"strokeBottomWeight",
				"strokeLeftWeight",
				"strokeRightWeight",
				"arcData",
				"pointCount",
				"innerRadius",
				"vectorNetwork",
				"booleanOperation",
				"textAlignHorizontal",
				"textAlignVertical",
				"textAutoResize",
				"paragraphIndent",
				"paragraphSpacing",
				"listSpacing",
				"hangingPunctuation",
				"hangingList",
				"autoRename",
				"resolvedVariableModes"
			];
			const values = [];
			for (const key of keys) if (key in n) values.push([key, n[key]]);
			result.push([n.id, values]);
			if ("children" in n) for (const c of n.children) properties(c);
		}
		walk(root);
		properties(root);
		return JSON.stringify(result);
	}
	function getSource() {
		if (!source || source.removed) throw Error("请先选中导入根 Frame 并绑定。");
		if (!axis(source)) throw Error("首版仅支持未旋转、未缩放的根 Frame。");
		return source;
	}
	function localFrame(parent, name, box) {
		const f = mg.createFrame();
		parent.appendChild(f);
		f.name = name;
		f.fills = [];
		f.clipsContent = false;
		f.blendMode = "PASS_THROUGH";
		f.resize(Math.max(1, box.width), Math.max(1, box.height));
		f.x = box.x - parent.absoluteTransform[0][2];
		f.y = box.y - parent.absoluteTransform[1][2];
		return f;
	}
	async function organize(message) {
		try {
			if (message.type === "organize-bind") {
				const n = mg.document.currentPage.selection[0];
				if (mg.document.currentPage.selection.length !== 1 || n?.type !== "FRAME") throw Error("请在图层面板选中一个导入根 Frame。");
				const loaded = readPlan(n);
				refreshPlan(loaded, collect(n));
				source = n;
				plan = loaded;
				preview = void 0;
				diagnosis = void 0;
				await restoreRange(n);
				send({
					temporary: existingTemporary(n) ? {
						id: existingTemporary(n).id,
						name: existingTemporary(n).name
					} : null,
					plan,
					sourceId: n.id,
					sourceName: n.name,
					reset: true,
					hasRange: !!range,
					message: "已选择设计：" + n.name + (range ? "。已找回范围框，可直接选中调整。" : "。请创建范围框。")
				});
				return;
			}
			const root = getSource();
			if (message.sourceId && message.sourceId !== root.id) throw Error("设计已切换，请在当前设计重试。");
			if (!plan) throw Error("请先选择设计。");
			function commit(next) {
				next.revision = plan.revision + 1;
				savePlan(root, next);
				plan = next;
			}
			if (message.type === "organize-temp-keep" || message.type === "organize-temp-delete") {
				const node = await mg.getNodeById(message.id);
				if (!node || node.getPluginData("organizer-temp-owner") !== root.id) throw Error("临时副本已不存在或不属于当前设计。");
				if (message.type === "organize-temp-delete") node.remove();
				else {
					node.name = root.name + " · 人工确认整理副本";
					node.setPluginData("organizer-temp-owner", "");
				}
				send({
					temporary: null,
					message: message.type === "organize-temp-delete" ? "临时副本已删除。" : "已保留人工确认的副本，未标记为无损通过。"
				});
				return;
			}
			if (message.type === "organize-conflict-locate") {
				const nodes = [];
				for (const id of message.ids ?? []) {
					if (!diagnosis?.ids.has(id)) continue;
					const n = await mg.getNodeById(id);
					if (n && "isVisible" in n) nodes.push(n);
				}
				if (nodes.length) {
					mg.document.currentPage.selection = nodes;
					scrollAndZoomIntoView(nodes);
				}
				send({ message: "已定位冲突相关图层。" });
				return;
			}
			if (message.type === "organize-plan") {
				if (message.revision !== plan.revision) throw Error("方案已更新，请重新操作。");
				const next = JSON.parse(JSON.stringify(plan));
				let notice = "方案已保存";
				const ids = Array.isArray(message.ids) ? [...new Set(message.ids)] : [];
				if (message.action === "create") notice = "已新建空分组「" + createGroup(next, message.name).name + "」。勾选图层后点击确认加入。";
				else if (message.action === "rename") {
					const g = next.groups.find((g) => g.id === message.group);
					if (!g) throw Error("分组不存在。");
					g.name = uniqueName(next, message.name, g.id);
				} else if (message.action === "delete") {
					if (!next.groups.some((g) => g.id === message.group)) throw Error("分组不存在。");
					next.groups = next.groups.filter((g) => g.id !== message.group);
					for (const c of next.records) if (c.group === message.group) c.group = 0;
					notice = "分组已删除，成员保留在外层。";
				} else if (message.action === "clear") {
					if (message.confirmed !== true) throw Error("请先确认清空方案。");
					commit(emptyPlan(root.id));
					preview = void 0;
					send({
						plan,
						reset: true,
						message: "整理方案已清空，原设计未删除。"
					});
					return;
				} else if (message.action === "remove-invalid") {
					refreshPlan(next, collect(root));
					next.records = next.records.filter((c) => !ids.includes(c.id) || !c.invalid);
				} else if (message.action === "assign") {
					refreshPlan(next, collect(root));
					const previous = next.records.filter((c) => ids.includes(c.id) && c.group && c.group !== message.group).map((c) => next.groups.find((g) => g.id === c.group)?.name).filter(Boolean);
					assignGroup(next, ids, Number(message.group));
					notice = "已将 " + ids.length + " 个图层" + (message.group ? "加入「" + next.groups.find((g) => g.id === message.group).name + "」" : "保留在外层") + (previous.length ? "；已从原分组 " + [...new Set(previous)].join("、") + " 移出" : "") + "。";
				} else if (message.action === "adopt") {
					if (!preview || rangeChanged()) throw Error("范围已变化，请重新识别建议。");
					if (preview.signature !== signature(root, preview.visibility)) throw Error("设计已变化，请重新识别建议。");
					refreshPlan(next, collect(root));
					let count = 0;
					for (const row of new Set(message.suggestions ?? [])) {
						const candidates = preview.items.filter((c) => c.row === row && c.row > 0 && next.records.find((r) => r.id === c.id)?.group === null);
						if (!candidates.length) continue;
						let name = "分组 " + next.nextId;
						while (next.groups.some((g) => g.name === name)) name += " 新";
						const g = createGroup(next, name);
						assignGroup(next, candidates.map((c) => c.id), g.id);
						count++;
					}
					if (!count) throw Error("没有可采用的建议；已确认归属不会覆盖。");
					notice = "已采用 " + count + " 个建议分组并保存。";
				} else throw Error("未知方案操作。");
				commit(next);
				send({
					plan,
					message: notice,
					...message.action === "assign" ? { assignment: {
						ids,
						group: Number(message.group)
					} } : {}
				});
				return;
			}
			if (message.type === "organize-check") {
				if (preview && rangeChanged()) {
					preview = void 0;
					send({
						stale: true,
						hasRange: !!range && !range.removed,
						message: "范围已变化，请重新识别。"
					});
				}
				return;
			}
			if (message.type === "organize-delete-range") {
				await restoreRange(root);
				if (range) range.remove();
				range = void 0;
				root.setPluginData("organizer-range-id", "");
				preview = void 0;
				send({
					stale: true,
					hasRange: false,
					message: "范围框已删除，已保存分组不变。"
				});
				return;
			}
			if (message.type === "organize-range") {
				await restoreRange(root);
				if (range) {
					mg.document.currentPage.selection = [range];
					scrollAndZoomIntoView([range]);
					send({
						hasRange: true,
						message: "已选中原范围框，可拖动或缩放，然后重新识别。"
					});
					return;
				}
				const b = root.absoluteBoundingBox;
				range = mg.createRectangle();
				range.name = "整理范围 · 拖动并调整大小";
				range.fills = [];
				range.strokes = [{
					type: "SOLID",
					color: {
						r: 1,
						g: .3,
						b: 0
					}
				}];
				range.strokeWeight = 2;
				range.resize(Math.max(20, b.width * .3), Math.max(20, b.height * .8));
				range.x = b.x;
				range.y = b.y;
				range.setPluginData("organizer-range", "true");
				range.setPluginData("organizer-owner", root.id);
				root.setPluginData("organizer-range-id", range.id);
				mg.document.currentPage.selection = [range];
				send({
					hasRange: true,
					message: "已创建橙色范围框。拖动和缩放到列表区域后，点击识别。"
				});
				return;
			}
			if (message.type === "organize-scan") {
				const selected = mg.document.currentPage.selection[0];
				if (selected?.type === "RECTANGLE" && !root.findOne((n) => n.id === selected.id)) {
					const owner = selected.getPluginData("organizer-owner");
					if (owner && owner !== root.id) throw Error("这个范围框属于其他设计，请点击选中范围框。");
					range = selected;
					range.setPluginData("organizer-owner", root.id);
					root.setPluginData("organizer-range-id", range.id);
				} else await restoreRange(root);
				if (!range || range.removed) throw Error("请先创建或选择根 Frame 外的范围矩形。");
				if (!axis(range)) throw Error("范围矩形不能旋转。");
				const region = range.absoluteBoundingBox;
				if (!overlap(region, root.absoluteBoundingBox)) throw Error("范围框没有覆盖已绑定的设计。");
				const items = recognize(collect(root, region), region);
				if (items.length > 1e3) throw Error("区域超过1000个候选，请缩小范围。");
				const next = JSON.parse(JSON.stringify(plan));
				refreshPlan(next, collect(root));
				mergeScan(next, items);
				commit(next);
				preview = {
					items,
					region,
					signature: signature(root),
					visibility: /* @__PURE__ */ new Map()
				};
				send({
					plan,
					hasRange: true,
					message: "识别完成。建议尚未加入方案，请确认采用或手动分配。",
					items,
					region
				});
				return;
			}
			if (message.type === "organize-visibility") {
				const candidate = plan.records.find((c) => c.id === message.id);
				if (!candidate) throw Error("图层不在当前识别结果中。");
				const node = await mg.getNodeById(candidate.id);
				if (!node || !("isVisible" in node)) throw Error("图层已不存在，请重新识别。");
				let ancestor = node.parent;
				while (ancestor && ancestor.id !== root.id) ancestor = ancestor.parent;
				if (!ancestor) throw Error("图层已移出当前设计，请重新识别。");
				const original = preview?.visibility.get(node.id)?.original ?? node.isVisible;
				node.isVisible = !node.isVisible;
				preview?.visibility.set(node.id, {
					original,
					current: node.isVisible
				});
				candidate.isVisible = node.isVisible;
				send({
					visibility: {
						id: node.id,
						visible: node.isVisible
					},
					message: node.name + (node.isVisible ? "：已显示" : "：已隐藏")
				});
				return;
			}
			if (message.type === "organize-locate") {
				const n = await mg.getNodeById(message.id);
				if (n && "isVisible" in n) {
					mg.document.currentPage.selection = [n];
					scrollAndZoomIntoView([n]);
				}
				return;
			}
			if ([
				"organize-apply",
				"organize-diagnose",
				"organize-trial"
			].includes(message.type)) {
				const existing = existingTemporary(root);
				if (message.type === "organize-trial" && existing) {
					send({
						temporary: {
							id: existing.id,
							name: existing.name
						},
						message: "已有待核对临时副本，请先保留或删除。"
					});
					return;
				}
				const current = collect(root);
				refreshPlan(plan, current);
				const invalid = plan.records.filter((c) => c.group && (c.invalid || !c.safe));
				if (invalid.length) {
					send({
						plan,
						error: invalid.slice(0, 5).map((c) => "分组「" + plan.groups.find((g) => g.id === c.group)?.name + "」中的「" + c.name + "」：" + (c.invalid || c.reason)).join("；") + "。请调整方案，未生成副本。"
					});
					return;
				}
				const assigned = new Map(plan.records.map((c) => [c.id, c.group]));
				const items = current.map((c) => ({
					...c,
					row: assigned.get(c.id) ?? 0
				}));
				const groupLabel = (id) => plan.groups.find((g) => g.id === id)?.name ?? "分组 " + id;
				const chosen = items.filter((c) => c.row > 0);
				if (!chosen.length) throw Error("请先确认加入图层，空分组不会生成 Frame。");
				if (current.some((c) => c.scopeId)) {
					const domains = /* @__PURE__ */ new Map();
					for (const group of new Set(chosen.map((c) => c.row))) {
						const members = chosen.filter((c) => c.row === group), nodes = await Promise.all(members.map((c) => mg.getNodeById(c.id)));
						const parent = nodes[0]?.parent;
						if (!parent || parent.type !== "FRAME" || !axis(parent) || nodes.some((n) => n?.parent !== parent) || members.some((c) => c.scopeId && c.scopeId !== parent.id)) throw Error("分组「" + groupLabel(group) + "」跨越不同蒙版或父级范围，请拆成独立分组；未生成副本。");
						const entry = domains.get(parent.id) ?? {
							parent,
							members: [],
							order: []
						};
						entry.members.push(...members);
						domains.set(parent.id, entry);
					}
					for (const entry of domains.values()) {
						const rows = entry.parent.children.filter((n) => !("isMask" in n) || !n.isMask).map((n, order) => ({
							id: n.id,
							name: n.name,
							box: ("absoluteRenderBounds" in n ? n.absoluteRenderBounds : null) ?? n.absoluteBoundingBox,
							safe: true,
							reason: "",
							category: "review",
							order,
							row: entry.members.find((c) => c.id === n.id)?.row ?? 0,
							effectiveVisible: effectiveVisible(n)
						}));
						if (rows.some((c) => !c.box)) throw Error("无法读取蒙版内图层边界，未生成副本。");
						const result = arrange(rows);
						if (result.cycle.length) throw Error("父级「" + entry.parent.name + "」内部存在交错遮挡，请调整分组归属；未生成副本。");
						entry.order = result.order;
					}
					if (message.type === "organize-diagnose") {
						send({
							plan,
							conflicts: [],
							message: "检查通过，将在原父级蒙版范围内生成完整分组。"
						});
						return;
					}
					const outputs = root.parent && "children" in root.parent ? root.parent.children.filter((n) => n.getPluginData("organizer-output-source") === root.id) : [];
					const copy = root.clone();
					try {
						const map = /* @__PURE__ */ new Map();
						function pair(a, b) {
							map.set(a.id, b);
							if ("children" in a && "children" in b) a.children.forEach((c, i) => pair(c, b.children[i]));
						}
						pair(root, copy);
						copy.x = Math.max(root.x + root.width, ...outputs.map((n) => n.x + n.width)) + 100;
						copy.y = root.y;
						copy.name = root.name + " · 区域整理副本";
						copy.setPluginData("organizer-output-source", root.id);
						copy.setPluginData("organizer-range-id", "");
						clearCopiedPlan(copy);
						const results = [];
						for (const entry of domains.values()) {
							const parent = map.get(entry.parent.id);
							const groups = /* @__PURE__ */ new Map();
							for (const row of new Set(entry.members.map((c) => c.row))) {
								const nodes = entry.members.filter((c) => c.row === row).map((c) => map.get(c.id));
								const group = localFrame(parent, groupLabel(row), boundsOf(nodes.map((n) => n.absoluteBoundingBox)));
								groups.set(row, group);
								results.push(group);
								for (const n of nodes) {
									const x = n.x, y = n.y;
									group.appendChild(n);
									n.x = x - group.x;
									n.y = y - group.y;
								}
							}
							for (const key of entry.order) {
								const n = key.startsWith("g:") ? groups.get(Number(key.slice(2))) : map.get(key.slice(2));
								if (n) parent.appendChild(n);
							}
						}
						mg.document.currentPage.selection = results;
						scrollAndZoomIntoView(results);
						send({
							plan,
							conflicts: [],
							message: "已按整个方案生成 " + results.length + " 个完整分组，保留原父级蒙版结构。"
						});
						return;
					} catch (e) {
						copy.remove();
						throw e;
					}
				}
				const checked = await diagnoseStack(root, items);
				const byId = new Map(items.map((c) => [c.id, c]));
				const conflicts = checked.graph.cycle.slice(0, 40).map((e) => ({
					lower: byId.get(e.lower),
					upper: byId.get(e.upper),
					kind: e.kind,
					evidence: e.kind === "retained-order" ? "保留图层之间的原始顺序" : alphaPairs.get(pairKey(e.lower, e.upper)) === "overlap" ? "已检测到可见像素重叠" : "边界交叠，透明检测不适用或未能确认"
				}));
				diagnosis = {
					stamp: checked.stamp,
					revision: plan.revision,
					ids: new Set(conflicts.flatMap((c) => [c.lower.id, c.upper.id]))
				};
				if (conflicts.length) {
					const newRecords = conflicts.flatMap((c) => [c.lower, c.upper]).filter((c) => !plan.records.some((r) => r.id === c.id));
					if (newRecords.length) {
						const next = JSON.parse(JSON.stringify(plan));
						mergeScan(next, newRecords);
						commit(next);
						diagnosis.revision = plan.revision;
					}
				}
				const trial = message.type === "organize-trial";
				if (conflicts.length && !trial) {
					send({
						plan,
						conflicts,
						conflictTotal: checked.graph.cycle.length,
						error: "存在 " + conflicts.filter((c) => c.kind === "overlap").length + " 处需要核对的遮挡关系。请在冲突面板调整，未生成副本。"
					});
					return;
				}
				if (message.type === "organize-diagnose") {
					send({
						plan,
						conflicts: [],
						message: checked.common.cycle.length ? "检查通过：各分组可保持完整，需分别放置，不添加共同容器。" : "检查通过，可以生成完整分组。"
					});
					return;
				}
				const ordered = [...chosen].sort((a, b) => a.order - b.order);
				const rowOrder = checked.graph.order.filter((k) => k.startsWith("g:")).map((k) => Number(k.slice(2)));
				if (trial && conflicts.length) {
					rowOrder.length = 0;
					rowOrder.push(...new Set(ordered.map((c) => c.row)));
				}
				const common = !checked.common.cycle.length && !trial;
				const layout = trial && conflicts.length ? [...new Set(items.map((c) => unit(c)))] : common ? checked.common.order : checked.graph.order;
				const previousOutputs = root.parent && "children" in root.parent ? root.parent.children.filter((n) => n.getPluginData("organizer-output-source") === root.id) : [];
				const nextX = Math.max(root.x + root.width, ...previousOutputs.map((n) => n.x + n.width)) + 100;
				const clone = root.clone();
				clone.setPluginData("organizer-range-id", "");
				clearCopiedPlan(clone);
				clone.name = root.name + (trial ? " · 待核对临时副本" : " · 区域整理副本");
				if (trial) clone.setPluginData("organizer-temp-owner", root.id);
				clone.setPluginData("organizer-output-source", root.id);
				clone.x = nextX;
				clone.y = root.y;
				try {
					const map = /* @__PURE__ */ new Map();
					function pair(a, b) {
						map.set(a.id, b);
						if ("children" in a && "children" in b) a.children.forEach((c, i) => pair(c, b.children[i]));
					}
					pair(root, clone);
					const dx = clone.absoluteTransform[0][2] - root.absoluteTransform[0][2], dy = clone.absoluteTransform[1][2] - root.absoluteTransform[1][2];
					const atoms = [];
					function flat(n) {
						if (expandable(n) && "children" in n) for (const c of n.children) flat(c);
						else {
							const copy = map.get(n.id);
							if (!copy) throw Error("副本节点缺失，请重新识别。");
							atoms.push(copy);
						}
					}
					for (const c of root.children) flat(c);
					const missing = chosen.filter((c) => !atoms.includes(map.get(c.id)));
					if (missing.length) throw Error("无法展开：" + missing.map((c) => c.name).slice(0, 5).join("、") + "；请重新识别。");
					for (const n of atoms) {
						const x = n.absoluteTransform[0][2], y = n.absoluteTransform[1][2];
						clone.appendChild(n);
						n.x = x - clone.absoluteTransform[0][2];
						n.y = y - clone.absoluteTransform[1][2];
					}
					for (const n of [...clone.children]) if (!atoms.includes(n)) n.remove();
					if (chosen.map((c) => clone.children.indexOf(map.get(c.id))).some((i) => i < 0)) throw Error("存在不能安全展开的层级，未生成副本。");
					const region = boundsOf(chosen.map((c) => ({
						...c.box,
						x: c.box.x + dx,
						y: c.box.y + dy
					})));
					const groups = /* @__PURE__ */ new Map();
					const list = common ? localFrame(clone, "区域列表 · 整理", region) : void 0;
					for (const row of rowOrder) {
						const members = ordered.filter((c) => c.row === row), b = boundsOf(members.map((c) => ({
							...c.box,
							x: c.box.x + dx,
							y: c.box.y + dy
						})));
						const group = localFrame(list ?? clone, groupLabel(row), b);
						groups.set(row, group);
						for (const c of members) {
							const n = map.get(c.id), x = n.absoluteTransform[0][2], y = n.absoluteTransform[1][2];
							group.appendChild(n);
							n.x = x - group.absoluteTransform[0][2];
							n.y = y - group.absoluteTransform[1][2];
						}
					}
					for (const key of layout) {
						const n = key === "list" ? list : key.startsWith("g:") ? groups.get(Number(key.slice(2))) : map.get(key.slice(2));
						if (n) clone.appendChild(n);
					}
					const results = list ? [list] : [...groups.values()];
					mg.document.currentPage.selection = results;
					scrollAndZoomIntoView(results);
					send({
						plan,
						conflicts: trial ? conflicts : [],
						...trial ? { temporary: {
							id: clone.id,
							name: clone.name
						} } : {},
						message: trial ? "已创建待核对临时副本，可能存在外观差异。请与左侧原设计对照，再选择保留或删除。" : "已按整个方案生成 " + groups.size + " 个完整分组。" + (common ? "" : "为保留遮挡关系，各分组分别放置，未添加共同容器。") + "原设计保持原位。"
					});
				} catch (e) {
					clone.remove();
					throw e;
				}
			}
		} catch (e) {
			send({ error: e instanceof Error ? e.message : String(e) });
		}
	}
	//#endregion
	//#region src/model.ts
	function fontMatches(source, target) {
		const norm = (v) => v.toLowerCase().replace(/[^a-z0-9\u0080-\uffff]/g, "").replace(/(?:ps)?mt$/, "").replace(/ps(?=bold|italic)/g, "");
		return norm(source) === norm(target.family + target.style) || target.style === "Regular" && norm(source) === norm(target.family);
	}
	//#endregion
	//#region src/main.ts
	var active;
	var imageHashes = /* @__PURE__ */ new Map();
	var fontLoads = /* @__PURE__ */ new Map();
	var cancelledSessions = /* @__PURE__ */ new Set();
	var reply = (session, replyTo, data = {}) => psdUi.postMessage({
		type: "ok",
		session,
		replyTo,
		...data
	});
	var blendMap = {
		normal: "NORMAL",
		"pass through": "PASS_THROUGH",
		darken: "DARKEN",
		multiply: "MULTIPLY",
		"color burn": "COLOR_BURN",
		lighten: "LIGHTEN",
		screen: "SCREEN",
		"color dodge": "COLOR_DODGE",
		"linear dodge": "LINEAR_DODGE",
		overlay: "OVERLAY",
		"soft light": "SOFT_LIGHT",
		"hard light": "HARD_LIGHT",
		difference: "DIFFERENCE",
		exclusion: "EXCLUSION",
		hue: "HUE",
		saturation: "SATURATION",
		color: "COLOR",
		luminosity: "LUMINOSITY",
		"linear burn": "LINEAR_BURN"
	};
	function paint(p) {
		if (p.kind === "solid") {
			const c = p.color;
			return {
				type: "SOLID",
				color: {
					r: c.r,
					g: c.g,
					b: c.b,
					a: c.a
				}
			};
		}
		const a = -(p.angle ?? 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), scale = Math.max(.001, p.scale ?? 1);
		const m00 = c / scale, m01 = -s / scale, m02 = .5 - (c - s) * .5 / scale;
		const m10 = s / scale, m11 = c / scale, m12 = .5 - (s + c) * .5 / scale;
		// MasterGo 用 transform + gradientHandlePositions，二者由同一矩阵推导以保持一致
		const tp = (x, y) => ({ x: m00 * x + m01 * y + m02, y: m10 * x + m11 * y + m12 });
		return {
			type: p.kind === "radial" ? "GRADIENT_RADIAL" : "GRADIENT_LINEAR",
			gradientStops: (p.stops ?? []).map((s) => ({
				position: s.position,
				color: {
					r: s.color.r,
					g: s.color.g,
					b: s.color.b,
					a: s.color.a ?? 1
				}
			})),
			transform: [
				[m00, m01, m02],
				[m10, m11, m12]
			],
			gradientHandlePositions: [tp(0.5, 0), tp(0.5, 1), tp(1, 0)]
		};
	}
	function frame(parent, name, b) {
		const n = mg.createFrame();
		parent.appendChild(n);
		n.name = name;
		n.fills = [];
		n.clipsContent = false;
		n.resize(Math.max(.01, b.width), Math.max(.01, b.height));
		n.x = b.x;
		n.y = b.y;
		return n;
	}
	function vector(parent, paths, name) {
		const n = mg.createPen();
		parent.appendChild(n);
		n.name = name;
		const compounds = /* @__PURE__ */ new Map();
		for (const p of paths) {
			const parts = compounds.get(p.winding) ?? [];
			parts.push(p.data);
			compounds.set(p.winding, parts);
		}
		n.penPaths = [...compounds].map(([windingRule, data]) => ({
			data: data.join(" "),
			windingRule
		}));
		n.x = 0;
		n.y = 0;
		return n;
	}
	function images(parent, tiles, name) {
		const n = frame(parent, name, {
			x: 0,
			y: 0,
			width: parent.width,
			height: parent.height
		});
		for (const t of tiles) {
			const r = mg.createRectangle();
			n.appendChild(r);
			r.name = `${name} ${t.x},${t.y}`;
			r.resize(t.width, t.height);
			r.x = t.x;
			r.y = t.y;
			r.fills = [{
				type: "IMAGE",
				imageRef: t.hash,
				scaleMode: "FILL"
			}];
		}
		return n;
	}
	function coloredImages(parent, tiles, name, color) {
		const group = frame(parent, name + " · 颜色叠加", {
			x: 0,
			y: 0,
			width: parent.width,
			height: parent.height
		});
		const mask = images(group, tiles, "原图透明度蒙版");
		mask.isMask = true;
		mask.isMaskOutline = false;
		const fill = mg.createRectangle();
		group.appendChild(fill);
		fill.name = "叠加颜色 · 可修改填充";
		fill.x = 0;
		fill.y = 0;
		fill.resize(parent.width, parent.height);
		fill.fills = [paint({
			kind: "solid",
			color
		})];
		return group;
	}
	function recolorEditable(node, color) {
		const fill = paint({
			kind: "solid",
			color
		});
		if (node.type === "TEXT") node.fills = [fill];
		else if (node.type === "VECTOR" || node.type === "RECTANGLE" || node.type === "ELLIPSE") {
			node.fills = node.fills === mg.mixed ? [fill] : node.fills.map((p) => ({
				...fill,
				color: { ...fill.color, a: (p.color && typeof p.color.a === "number") ? p.color.a : 1 }
			}));
			node.strokes = node.strokes.map((p) => ({
				...fill,
				color: { ...fill.color, a: (p.color && typeof p.color.a === "number") ? p.color.a : 1 }
			}));
		} else if ("children" in node) for (const child of node.children) recolorEditable(child, color);
	}
	function loadFont(f) {
		const key = JSON.stringify(f);
		let p = fontLoads.get(key);
		if (!p) {
			p = mg.loadFontAsync(f);
			fontLoads.set(key, p);
			p.catch(() => fontLoads.delete(key));
		}
		return p;
	}
	function ensure(s) {
		if (s.cancelled || active !== s) throw new Error("已取消");
	}
	function issue(m, code, message) {
		if (!m.issues.some((i) => i.code === code && i.message === message)) m.issues.push({
			code,
			message
		});
		if (m.outcome === "native") m.outcome = "approximate";
	}
	async function text(parent, m, s) {
		const t = { ...m.text };
		bakeTextScale(t);
		if (t.paragraphs) {
			let y = 0;
			for (const p of t.paragraphs) {
				y += p.spaceBefore;
				const runs = t.runs.filter((r) => r.end > p.start && r.start < p.end).map((r) => ({
					...r,
					start: Math.max(r.start, p.start) - p.start,
					end: Math.min(r.end, p.end) - p.start
				}));
				if (!runs.length) runs.push({
					...t.runs[0],
					start: 0,
					end: 0
				});
				const n = await text(parent, {
					...m,
					text: {
						...t,
						value: t.value.slice(p.start, p.end),
						paragraphs: void 0,
						runs,
						align: p.align,
						localY: t.localY + y
					}
				}, s);
				y += n.height + p.spaceAfter;
			}
			return parent;
		}
		const selected = [];
		for (const r of t.runs) {
			let f = s.options.fonts[r.style.font] ?? {
				family: "Inter",
				style: "Regular"
			};
			try {
				await loadFont(f);
			} catch {
				f = {
					family: "Inter",
					style: "Regular"
				};
				await loadFont(f);
				issue(m, "font-load", `字体 ${r.style.font} 加载失败，改用 Inter Regular。`);
			}
			ensure(s);
			selected.push(f);
			if (!fontMatches(r.style.font, f)) issue(m, "font-substitution", `${r.style.font} → ${f.family} ${f.style}`);
		}
		const n = mg.createText();
		parent.appendChild(n);
		n.name = m.name;
		// MasterGo 规定：写入 characters 前必须加载该文本节点当前已使用的字体。
		// 新建节点的默认字体与替代字体不同，未加载时赋值会抛异常，导致文字空白。
		const currentFont = n.textStyles && n.textStyles[0] && n.textStyles[0].textStyle
			? n.textStyles[0].textStyle.fontName
			: null;
		if (currentFont) {
			try { await loadFont(currentFont); } catch (e) { /* 默认字体不可用时忽略 */ }
		}
		// MasterGo 没有竖排文本属性，用「逐字换行 + 水平居中」还原中文竖排观感
		const vertical = t.vertical === true;
		// 竖排后第 i 个字位于 2i，奇数位是换行符，因此 run 范围需按 2 倍映射
		const S = (i) => vertical ? i * 2 : i;
		const E = (i) => vertical ? i * 2 - 1 : i;
		n.characters = vertical ? Array.from(t.value).join("\n") : t.value;
		n.setRangeFontName(0, Array.from(n.characters || "").length, selected[0]);
		for (let i = 0; i < t.runs.length; i++) {
			const r = t.runs[i], v = r.style;
			if (r.end <= r.start) continue;
			n.setRangeFontName(S(r.start), E(r.end), selected[i]);
			n.setRangeFontSize(S(r.start), E(r.end), v.size);
			n.setRangeFills(S(r.start), E(r.end), [{
				type: "SOLID",
				color: {
					r: v.color.r,
					g: v.color.g,
					b: v.color.b,
					a: v.color.a
				}
			}]);
			n.setRangeLetterSpacing(S(r.start), E(r.end), {
				unit: "PERCENT",
				value: v.tracking
			});
			if (v.leading) n.setRangeLineHeight(S(r.start), E(r.end), {
				unit: "PIXELS",
				value: v.leading
			});
			n.setRangeTextDecoration(S(r.start), E(r.end), v.strike ? "STRIKETHROUGH" : v.underline ? "UNDERLINE" : "NONE");
		}
		n.textAlignHorizontal = vertical ? "CENTER" : t.align;
		n.textAutoResize = vertical || !t.box ? "WIDTH_AND_HEIGHT" : "HEIGHT";
		if (t.box) n.resize(Math.max(1, t.width), Math.max(1, m.bounds.height));
		if (t.matrix?.length === 6) {
			const [a, b, c, d, tx, ty] = t.matrix;
			if (Math.abs(a * d - b * c) < 1e-8) throw new Error("文字变换矩阵不可逆");
			n.relativeTransform = [[
				a,
				c,
				tx + a * t.localX + c * t.localY - m.bounds.x
			], [
				b,
				d,
				ty + b * t.localX + d * t.localY - m.bounds.y
			]];
		} else {
			n.x = 0;
			n.y = 0;
		}
		const matrix = t.matrix;
		const unrotated = !matrix || Math.abs(matrix[1]) < 1e-6 && Math.abs(matrix[2]) < 1e-6 && matrix[0] > 0 && matrix[3] > 0;
		const lineHeight = Math.max(...t.runs.map((r) => r.style.leading ?? r.style.size * 1.2));
		if (!t.value.includes("\n") && !t.value.includes("\r") && unrotated && n.height <= lineHeight * 1.25) {
			const width = n.width;
			n.textAutoResize = "NONE";
			n.resize(Math.max(1, width), Math.max(1, m.bounds.height / (matrix?.[3] ?? 1)));
			n.textAlignVertical = "CENTER";
			n.y = 0;
		}
		return n;
	}
	async function layer(m, s) {
		ensure(s);
		const parent = m.parentId ? s.nodes.get(m.parentId) : s.root;
		if (!parent) throw new Error(`找不到父图层 ${m.parentId}`);
		const origin = m.parentId ? s.origins.get(m.parentId) : {
			x: 0,
			y: 0,
			width: s.document.width,
			height: s.document.height
		};
		const holder = frame(parent, m.name, {
			...m.bounds,
			x: m.bounds.x - origin.x,
			y: m.bounds.y - origin.y
		});
		holder.setPluginData("psd-source", JSON.stringify({
			id: m.id,
			path: m.path,
			metadata: m.metadata
		}));
		const imageTiles = s.assets.get(`${m.id}:image`) ?? [], maskTiles = s.assets.get(`${m.id}:mask`) ?? [];
		try {
			let content;
			if (m.kind === "group") {
				s.nodes.set(m.id, holder);
				s.origins.set(m.id, m.bounds);
				if (m.fill) holder.fills = [paint(m.colorOverlay ? {
					kind: "solid",
					color: m.colorOverlay
				} : m.fill)];
				holder.clipsContent = m.artboard;
			} else if (m.kind === "text") content = await text(holder, m, s);
			else if (m.kind === "vector" && m.paths?.length) {
				let v;
				if (m.primitive) {
					v = m.primitive.kind === "ellipse" ? mg.createEllipse() : mg.createRectangle();
					holder.appendChild(v);
					v.name = m.name;
					v.resize(m.primitive.bounds.width, m.primitive.bounds.height);
					v.x = m.primitive.bounds.x - m.bounds.x;
					v.y = m.primitive.bounds.y - m.bounds.y;
					if (v.type === "RECTANGLE" && m.primitive.radii) [v.topLeftRadius, v.topRightRadius, v.bottomRightRadius, v.bottomLeftRadius] = m.primitive.radii;
				} else v = vector(holder, m.paths, m.name);
				v.fills = m.fill ? [paint(m.fill)] : [];
				if (m.stroke) {
					v.strokes = [paint(m.stroke.paint)];
					v.strokeWeight = m.stroke.width;
					v.strokeAlign = m.stroke.align;
				}
				content = v;
			} else if (m.restrictedChannels && s.assets.has(`${m.id}:channel-add`) && s.assets.has(`${m.id}:channel-multiply`)) {
				for (const [kind, mode] of [["channel-multiply", "MULTIPLY"], ["channel-add", "LINEAR_DODGE"]]) {
					const pass = images(holder, s.assets.get(`${m.id}:${kind}`), kind === "channel-add" ? "通道颜色" : "通道底色");
					pass.blendMode = "PASS_THROUGH";
					for (const tile of pass.children) if ("blendMode" in tile) tile.blendMode = mode;
				}
				m.outcome = "image";
			} else if (imageTiles.length) {
				content = m.colorOverlay ? coloredImages(holder, imageTiles, m.name, m.colorOverlay) : images(holder, imageTiles, m.name);
				m.outcome = m.outcome === "incomplete" ? "incomplete" : "image";
			} else {
				m.outcome = "incomplete";
				issue(m, "no-content", "无可用内容，保留隐藏占位。");
				holder.isVisible = false;
			}
			if (content && m.colorOverlay && (m.kind === "text" || m.kind === "vector")) recolorEditable(content, m.colorOverlay);
			if (m.maskPaths?.length) {
				const mask = vector(holder, m.maskPaths, "矢量蒙版");
				mask.fills = [{
					type: "SOLID",
					color: {
						r: 1,
						g: 1,
						b: 1
					}
				}];
				mask.isMask = true;
				mask.isMaskOutline = true;
				holder.insertChild(0, mask);
			}
			if (maskTiles.length) {
				const inner = frame(holder, "蒙版内容", {
					x: 0,
					y: 0,
					width: holder.width,
					height: holder.height
				});
				for (const child of [...holder.children]) if (child !== inner) {
					const x = child.x, y = child.y;
					inner.appendChild(child);
					child.x = x;
					child.y = y;
				}
				const mask = images(holder, maskTiles, "像素蒙版");
				mask.isMask = true;
				mask.isMaskOutline = false;
				holder.insertChild(0, mask);
				if (m.kind === "group") s.nodes.set(m.id, inner);
			} else if (m.kind === "group" && m.maskPaths?.length) {}
			if (m.effects.length && !m.bakeChannelShadows) holder.effects = m.effects.map((e) => ({
				type: e.inner ? "INNER_SHADOW" : "DROP_SHADOW",
				color: e.color,
				offset: {
					x: e.x,
					y: e.y
				},
				radius: e.radius,
				spread: e.spread,
				isVisible: true,
				blendMode: blendMap[e.blend] ?? "NORMAL"
			}));
			const bm = blendMap[m.blend];
			holder.blendMode = bm ?? "NORMAL";
			if (!bm) issue(m, "blend", `混合模式 ${m.blend} 使用普通模式近似。`);
			holder.opacity = m.restrictedChannels ? 1 : m.opacity;
			if (m.restrictedChannels) holder.blendMode = "PASS_THROUGH";
			if (m.outcome !== "incomplete" || holder.children.length) holder.isVisible = !m.hidden;
			holder.isLocked = m.locked;
			const key = m.parentId ?? "root";
			if (!m.clipping) s.clips.set(key, { base: holder });
			else {
				const clip = s.clips.get(key);
				if (clip) {
					if (!clip.container) {
						const base = clip.base, x = base.x, y = base.y, idx = parent.children.indexOf(base);
						const group = frame(parent, "剪贴组", {
							x: 0,
							y: 0,
							width: parent.width,
							height: parent.height
						});
						group.isVisible = base.isVisible;
						parent.insertChild(idx, group);
						const mask = base.clone();
						group.appendChild(mask);
						mask.x = x;
						mask.y = y;
						mask.isLocked = false;
						mask.isVisible = true;
						mask.opacity = 1;
						mask.effects = [];
						mask.isMask = true;
						mask.isMaskOutline = false;
						mask.name = "剪贴基底蒙版";
						group.appendChild(base);
						base.x = x;
						base.y = y;
						clip.container = group;
					}
					const x = holder.x, y = holder.y;
					clip.container.appendChild(holder);
					holder.x = x;
					holder.y = y;
					issue(m, "clipping", "剪贴范围由基底透明度生成，复杂混合与组基底需对照检查。");
				} else issue(m, "clipping-base", "未找到剪贴基底，按普通图层导入。");
			}
		} catch (e) {
			ensure(s);
			for (const child of [...holder.children]) child.remove();
			holder.fills = [];
			holder.effects = [];
			if (imageTiles.length) {
				m.colorOverlay ? coloredImages(holder, imageTiles, "转换失败后的像素保留", m.colorOverlay) : images(holder, imageTiles, "转换失败后的像素保留");
				m.outcome = "image";
			} else {
				holder.isVisible = false;
				m.outcome = "incomplete";
			}
			issue(m, "node-conversion", e instanceof Error ? e.message : String(e));
			if (m.kind === "group") {
				s.nodes.set(m.id, holder);
				s.origins.set(m.id, m.bounds);
			}
		}
		s.assets.delete(`${m.id}:channel-multiply`);
		s.assets.delete(`${m.id}:channel-add`);
		s.assets.delete(`${m.id}:image`);
		s.assets.delete(`${m.id}:mask`);
		if (m.issues.length && m.outcome === "native") m.outcome = "approximate";
		s.results.push({
			id: m.id,
			nodeId: holder.id,
			name: m.name,
			path: m.path,
			kind: m.kind,
			outcome: m.outcome,
			issues: m.issues
		});
		holder.setPluginData("psd-outcome", m.outcome);
		await new Promise((r) => setTimeout(r, 0));
		ensure(s);
	}
	function cleanup(s) {
		for (const n of s.roots) if (!n.removed) n.remove();
		s.assets.clear();
		s.nodes.clear();
		if (active === s) active = void 0;
	}
	/** MasterGo 混合模式名到 PSD 名称的映射。 */
	var PSD_BLEND = {
		PASS_THROUGH: "pass through",
		NORMAL: "normal",
		DISSOLVE: "dissolve",
		DARKEN: "darken",
		MULTIPLY: "multiply",
		COLOR_BURN: "color burn",
		LIGHTEN: "lighten",
		SCREEN: "screen",
		COLOR_DODGE: "color dodge",
		OVERLAY: "overlay",
		SOFT_LIGHT: "soft light",
		HARD_LIGHT: "hard light",
		DIFFERENCE: "difference",
		EXCLUSION: "exclusion",
		HUE: "hue",
		SATURATION: "saturation",
		COLOR: "color",
		LUMINOSITY: "luminosity"
	};
	/**
	 * 采集单个节点的位图，失败时返回 undefined（该图层会被跳过）。
	 * @param node 目标节点
	 * @param scale 导出倍率
	 * @returns PNG 字节
	 */
	async function exportRaster(node, scale) {
		try {
			return await node.exportAsync({
				format: "PNG",
				constraint: {
					type: "SCALE",
					value: scale
				},
				useAbsoluteBounds: true,
				useRenderBounds: true
			});
		} catch {
			return void 0;
		}
	}
	/**
	 * 取节点用于导出的绝对边界。
	 * 导出默认按渲染边界出图（含描边、阴影等效果的外扩，文本则收紧到字形范围），
	 * 定位必须用同一口径，否则位图会以几何边界为原点摆放而整体偏移。
	 * @param node 目标节点
	 * @returns 可用的边界，宽高无效时为 null
	 */
	function exportBounds(node) {
		const render = node.absoluteRenderBounds;
		if (render && render.width > 0 && render.height > 0) return render;
		const box = node.absoluteBoundingBox;
		return box && box.width > 0 && box.height > 0 ? box : null;
	}
	/**
	 * 统计导出范围内的蒙版与容器裁剪情况，用于结果区自检。
	 * 蒙版位置非首位时遮罩范围会不同，单独记下来便于核对。
	 * @param nodes 顶层节点数组
	 * @returns 统计结果
	 */
	function scanMaskStats(nodes, skipHidden) {
		const stats = {
			容器: 0,
			蒙版节点: 0,
			蒙版在首位: 0,
			蒙版不在首位: 0,
			轮廓蒙版: 0,
			裁剪容器: 0,
			位置异常: [],
			跳过区域蒙版: 0,
			跳过区域裁剪: 0
		};
		const visit = (node, off) => {
			if (!("children" in node) || !node.children.length) return;
			const skipped = off || (skipHidden && node.isVisible === false);
			if (!skipped) stats.容器++;
			if ("clipsContent" in node && node.clipsContent === true) {
				if (skipped) stats.跳过区域裁剪++;
				else stats.裁剪容器++;
			}
			const kids = node.children;
			for (let i = 0; i < kids.length; i++) {
				const child = kids[i];
				if (!("isMask" in child) || child.isMask !== true) continue;
				if (skipped) {
					stats.跳过区域蒙版++;
					continue;
				}
				stats.蒙版节点++;
				if (child.isMaskOutline === true) stats.轮廓蒙版++;
				if (i === 0) stats.蒙版在首位++;
				else {
					stats.蒙版不在首位++;
					if (stats.位置异常.length < 12) stats.位置异常.push(node.name + " 的蒙版「" + child.name + "」在第 " + (i + 1) + " / " + kids.length + " 位");
				}
			}
			for (const child of kids) visit(child, skipped);
		};
		for (const node of nodes) visit(node, false);
		return stats;
	}
	/**
	 * 递归采集导出结构：容器节点变成 PSD 组，其余节点栅格化为图层。
	 * @param node 当前节点
	 * @param origin 导出范围的左上角（绝对坐标）
	 * @param scale 导出倍率
	 * @param options 采集选项
	 * @param progress 进度计数器
	 * @returns 导出项，无可导出内容时返回 null
	 */
	/**
	 * 采集蒙版节点的位图；尺寸无效或导出失败时返回 null。
	 * @param node 蒙版节点
	 * @param origin 导出范围的左上角（绝对坐标）
	 * @param scale 导出倍率
	 */
	/**
	 * 读取节点某个角的圆角值，缺失时回退到统一圆角。
	 * @param node 目标节点
	 * @param key 四个角之一的字段名
	 * @param fallback 回退值
	 * @returns 圆角像素值
	 */
	function cornerValue(node, key, fallback) {
		const value = node[key];
		return typeof value === "number" ? value : fallback;
	}
	/**
	 * 从渐变矩阵估算线性渐变的角度（度）。
	 * @param transform 2 × 3 变换矩阵
	 * @returns 角度，缺省为 90
	 */
	function gradientAngle(transform) {
		if (!Array.isArray(transform) || !Array.isArray(transform[0]) || !Array.isArray(transform[1])) return 90;
		const angle = Math.atan2(transform[1][0], transform[0][0]) * 180 / Math.PI + 90;
		return Math.round((angle % 360 + 360) % 360);
	}
	/**
	 * 从节点的填充里取第一个可还原的填充（纯色或渐变）。
	 * 图片填充、不可见填充与停点不足的渐变会被记录到报告里。
	 * @param node 目标节点
	 * @param progress 进度与统计
	 * @returns 填充描述；没有可还原的填充时返回 null
	 */
	function fillOf(node, progress) {
		if (!("fills" in node) || !Array.isArray(node.fills)) return null;
		let fill = null;
		let invisible = false;
		let hasImage = false;
		let badGradient = false;
		for (const paint of node.fills) {
			if (!paint || paint.isVisible === false) {
				invisible = true;
				continue;
			}
			if (paint.type === "SOLID") {
				const color = paint.color || {
					r: 0,
					g: 0,
					b: 0,
					a: 1
				};
				fill = {
					type: "color",
					color: {
						r: Math.round((color.r || 0) * 255),
						g: Math.round((color.g || 0) * 255),
						b: Math.round((color.b || 0) * 255)
					},
					opacity: typeof color.a === "number" ? color.a : 1
				};
				break;
			}
			if (typeof paint.type === "string" && paint.type.indexOf("GRADIENT") === 0) {
				const stops = (paint.gradientStops || []).map((stop) => {
					const c = stop.color || {};
					return {
						position: Math.max(0, Math.min(1, stop.position || 0)),
						color: {
							r: Math.round((c.r || 0) * 255),
							g: Math.round((c.g || 0) * 255),
							b: Math.round((c.b || 0) * 255)
						},
						alpha: typeof c.a === "number" ? c.a : 1
					};
				});
				if (stops.length < 2) {
					badGradient = true;
					continue;
				}
				fill = {
					type: "gradient",
					style: paint.type === "GRADIENT_RADIAL" ? "radial" : paint.type === "GRADIENT_ANGULAR" ? "angle" : paint.type === "GRADIENT_DIAMOND" ? "diamond" : "linear",
					angle: gradientAngle(paint.transform),
					opacity: typeof paint.alpha === "number" ? paint.alpha : 1,
					stops
				};
				break;
			}
			if (paint.type === "IMAGE") hasImage = true;
		}
		if (!fill) {
			const reason = hasImage ? "图片填充暂不还原为形状图层" : badGradient ? "渐变停点少于两个" : invisible ? "填充不可见" : "没有可还原的填充";
			if (progress) progress.shapeSkips.push({
				名称: node.name,
				原因: reason
			});
		}
		return fill;
	}
	/** 临时开关：基础形状（矩形 / 椭圆 / 直线）是否还原为矢量形状。 */
	const SHAPE_NODES_AS_VECTOR = false;
	/** 临时开关：形状图层是否写入描边。 */
	const STROKE_AS_VECTOR = false;
	/**
	 * 从节点的描边里取第一个可还原的描边。
	 * @param node 目标节点
	 * @returns 描边描述；没有可还原的描边时返回 null
	 */
	function strokeOf(node) {
		if (!STROKE_AS_VECTOR) return null;
		if (!("strokes" in node) || !Array.isArray(node.strokes) || !node.strokes.length) return null;
		const weight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
		if (weight <= 0) return null;
		for (const paint of node.strokes) {
			if (!paint || paint.isVisible === false) continue;
			if (paint.type !== "SOLID") continue;
			const color = paint.color || {
				r: 0,
				g: 0,
				b: 0,
				a: 1
			};
			const cap = node.strokeCap === "ROUND" ? "round" : node.strokeCap === "SQUARE" ? "square" : "butt";
			const join = node.strokeJoin === "ROUND" ? "round" : node.strokeJoin === "BEVEL" ? "bevel" : "miter";
			const align = node.strokeAlign === "OUTSIDE" ? "outside" : node.strokeAlign === "CENTER" ? "center" : "inside";
			return {
				width: Math.round(weight),
				color: {
					r: Math.round((color.r || 0) * 255),
					g: Math.round((color.g || 0) * 255),
					b: Math.round((color.b || 0) * 255)
				},
				opacity: typeof color.a === "number" ? color.a : 1,
				cap,
				join,
				align
			};
		}
		return null;
	}
	/**
	 * 把容器的填充采集为形状图层项（纯色 / 渐变 + 圆角）。
	 * 容器本身不是叶子，若不单独采集，它的底色会在导出时整个丢掉。
	 * @param node 容器节点
	 * @param box 容器边界
	 * @param origin 导出范围左上角
	 * @param scale 导出倍率
	 * @returns 形状项；没有可还原的填充时返回 null
	 */
	function collectShape(node, box, origin, scale, progress) {
		const fill = fillOf(node, progress);
		if (!fill) return null;
		const radius = typeof node.cornerRadius === "number" ? node.cornerRadius : 0;
		const tl = cornerValue(node, "topLeftRadius", radius);
		const tr = cornerValue(node, "topRightRadius", radius);
		const br = cornerValue(node, "bottomRightRadius", radius);
		const bl = cornerValue(node, "bottomLeftRadius", radius);
		if (progress) {
			progress.shapes.push({
				名称: node.name,
				填充: fill.type === "color" ? "纯色" : fill.style === "radial" ? "径向渐变" : fill.style === "angle" ? "角度渐变" : fill.style === "diamond" ? "菱形渐变" : "线性渐变",
				尺寸: Math.round(box.width) + " × " + Math.round(box.height),
				圆角: tl + " / " + tr + " / " + br + " / " + bl
			});
			const totalOpacity = (typeof node.opacity === "number" ? node.opacity : 1) * (typeof fill.opacity === "number" ? fill.opacity : 1);
			if (totalOpacity < 1) progress.fades.push({
				名称: node.name + "·底色",
				不透明度: Number(totalOpacity.toFixed(3)),
				类型: "形状图层（节点 × 填充）"
			});
		}
		return {
			kind: "shape",
			name: node.name + "·底色",
			left: Math.round((box.x - origin.x) * scale),
			top: Math.round((box.y - origin.y) * scale),
			width: Math.max(1, Math.round(box.width * scale)),
			height: Math.max(1, Math.round(box.height * scale)),
			corners: {
				topLeft: tl,
				topRight: tr,
				bottomRight: br,
				bottomLeft: bl
			},
			fill,
			stroke: strokeOf(node),
			shapeType: "rect",
			blend: PSD_BLEND[node.blendMode] || "normal",
			opacity: typeof node.opacity === "number" ? node.opacity : 1,
			hidden: node.isVisible === false
		};
	}
	/**
	 * 把基础形状节点（矩形、椭圆、直线）采集为矢量形状项。
	 * 这些节点是叶子，用位图表达会丢掉可编辑性，能还原成矢量时优先还原。
	 * @param node 形状节点
	 * @param box 节点边界（直线已按描边粗细补过）
	 * @param origin 导出范围左上角
	 * @param scale 导出倍率
	 * @param progress 进度与统计
	 * @returns 形状项；没有可还原的填充与描边时返回 null
	 */
	function collectNodeShape(node, box, origin, scale, progress) {
		const fill = fillOf(node, progress);
		const stroke = strokeOf(node);
		if (!fill && !stroke) return null;
		const radius = typeof node.cornerRadius === "number" ? node.cornerRadius : 0;
		const shapeType = node.type === "ELLIPSE" ? "ellipse" : node.type === "LINE" ? "line" : "rect";
		const item = {
			kind: "shape",
			name: node.name,
			shapeType,
			left: Math.round((box.x - origin.x) * scale),
			top: Math.round((box.y - origin.y) * scale),
			width: Math.max(1, Math.round(box.width * scale)),
			height: Math.max(1, Math.round(box.height * scale)),
			corners: {
				topLeft: cornerValue(node, "topLeftRadius", radius),
				topRight: cornerValue(node, "topRightRadius", radius),
				bottomRight: cornerValue(node, "bottomRightRadius", radius),
				bottomLeft: cornerValue(node, "bottomLeftRadius", radius)
			},
			fill,
			stroke,
			blend: PSD_BLEND[node.blendMode] || "normal",
			opacity: typeof node.opacity === "number" ? node.opacity : 1,
			hidden: node.isVisible === false
		};
		if (progress) {
			progress.shapes.push({
				名称: node.name,
				填充: fill ? fill.type === "color" ? "纯色" : "渐变" : "无填充（仅描边）",
				尺寸: item.width + " × " + item.height,
				圆角: shapeType === "rect" ? item.corners.topLeft + " / " + item.corners.topRight + " / " + item.corners.bottomRight + " / " + item.corners.bottomLeft : shapeType === "ellipse" ? "椭圆" : "直线"
			});
			const totalOpacity = item.opacity * (fill && typeof fill.opacity === "number" ? fill.opacity : 1);
			if (totalOpacity < 1) progress.fades.push({
				名称: node.name,
				不透明度: Number(totalOpacity.toFixed(3)),
				类型: "形状图层（节点 × 填充）"
			});
		}
		return item;
	}
	async function collectMask(node, origin, scale) {
		const box = exportBounds(node);
		if (!box) return null;
		const bytes = await exportRaster(node, scale);
		if (!bytes) return null;
		return {
			left: Math.round((box.x - origin.x) * scale),
			top: Math.round((box.y - origin.y) * scale),
			width: Math.max(1, Math.round(box.width * scale)),
			height: Math.max(1, Math.round(box.height * scale)),
			bytes
		};
	}
	async function collectExport(node, origin, scale, options, progress) {
		if (options.skipHidden && node.isVisible === false) {
			progress.skipped.push({
				名称: node.name,
				原因: "隐藏图层（已按设置跳过）"
			});
			return null;
		}
		let box = exportBounds(node);
		// 直线的高度为 0，可视范围由描边粗细决定，这里补出它的边界
		if (node.type === "LINE") {
			const weight = typeof node.strokeWeight === "number" && node.strokeWeight > 0 ? node.strokeWeight : 1;
			const base = node.absoluteBoundingBox || box;
			if (base && base.width > 0) box = {
				x: base.x,
				y: base.y - weight / 2,
				width: base.width,
				height: weight
			};
		}
		if (!box) {
			progress.skipped.push({
				名称: node.name,
				原因: "没有可用边界（宽或高为 0）"
			});
			return null;
		}
		// 基础形状节点优先还原为矢量形状，还原不了再退回位图
		if (SHAPE_NODES_AS_VECTOR && (node.type === "RECTANGLE" || node.type === "ELLIPSE" || node.type === "LINE")) {
			const vector = collectNodeShape(node, box, origin, scale, progress);
			if (vector) return vector;
		}
		const opacity = typeof node.opacity === "number" ? node.opacity : 1;
		const blend = PSD_BLEND[node.blendMode] || "normal";
		if ("children" in node && node.children.length) {
			const kids = [...node.children];
			// 透明蒙版可以是任意位置的子节点，按 MasterGo 约定遮罩它上方的兄弟
			const maskIndex = kids.findIndex((k) => "isMask" in k && k.isMask === true);
			let mask = null;
			if (maskIndex >= 0) {
				if (kids.length > 1) {
					mask = await collectMask(kids[maskIndex], origin, scale);
					if (!mask) progress.maskFails.push({
						组: node.name,
						蒙版: kids[maskIndex].name,
						原因: "蒙版位图采集失败（边界无效或导出报错）"
					});
				} else progress.maskFails.push({
					组: node.name,
					蒙版: kids[maskIndex].name,
					原因: "容器里只有蒙版，没有可遮罩的内容"
				});
			}
			const children = [];
			const shape = collectShape(node, box, origin, scale, progress);
			if (shape) children.push(shape);
			for (let i = 0; i < kids.length; i++) {
				if (i === maskIndex) {
					// 透明蒙版在画布上不显示；轮廓蒙版是可见的，除了作蒙版还要按普通图层导出
					if (kids[i].isMaskOutline === true) {
						const outline = await collectExport(kids[i], origin, scale, options, progress);
						if (outline) children.push(outline);
					}
					continue;
				}
				const item = await collectExport(kids[i], origin, scale, options, progress);
				if (!item) continue;
				if (mask && i > maskIndex) item.masked = true;
				children.push(item);
			}
			if (!children.length) {
				progress.skipped.push({
					名称: node.name,
					原因: "容器内没有可导出的内容"
				});
				return null;
			}
			if (opacity < 1) progress.fades.push({
				名称: node.name,
				不透明度: Number(opacity.toFixed(3)),
				类型: "组"
			});
			const group = {
				kind: "group",
				name: node.name,
				opacity,
				blend,
				hidden: node.isVisible === false,
				children
			};
			if (mask) {
				group.mask = mask;
				progress.masks.push({
					组: node.name,
					蒙版: kids[maskIndex].name,
					位置: maskIndex + 1 + " / " + kids.length
				});
			}
			// 容器裁剪：clipsContent 为 true 时，超出容器的子内容在画布上不可见
			if ("clipsContent" in node && node.clipsContent === true) {
				const clip = exportBounds(node);
				if (clip) {
					group.clip = {
						left: Math.round((clip.x - origin.x) * scale),
						top: Math.round((clip.y - origin.y) * scale),
						width: Math.max(1, Math.round(clip.width * scale)),
						height: Math.max(1, Math.round(clip.height * scale))
					};
					progress.clips.push({
						容器: node.name,
						范围: Math.round(clip.width) + " × " + Math.round(clip.height)
					});
				}
			}
			return group;
		}
		if (opacity < 1) progress.fades.push({
			名称: node.name,
			不透明度: Number(opacity.toFixed(3)),
			类型: "位图图层"
		});
		progress.done++;
		if (progress.done % 5 === 0) psdUi.postMessage({
			type: "export-progress",
			done: progress.done
		});
		const bytes = await exportRaster(node, scale);
		if (!bytes) {
			progress.skipped.push({
				名称: node.name,
				原因: "导出位图失败（节点过大或含不支持的效果）"
			});
			return null;
		}
		return {
			kind: "layer",
			name: node.name,
			left: Math.round((box.x - origin.x) * scale),
			top: Math.round((box.y - origin.y) * scale),
			width: Math.max(1, Math.round(box.width * scale)),
			height: Math.max(1, Math.round(box.height * scale)),
			opacity,
			blend: blend === "pass through" ? "normal" : blend,
			hidden: node.isVisible === false,
			bytes
		};
	}
	/**
	 * 把当前选中内容（没有选中时取整页）采集为导出结构并交给界面。
	 * @param m 界面请求，含 scale 与 skipHidden
	 */
	async function exportDocument(m) {
		const page = mg.document.currentPage;
		const scope = page.selection.length ? [...page.selection] : [...page.children];
		if (!scope.length) throw Error("当前页面没有可导出的图层。");
		const boxes = scope.map(exportBounds).filter((b) => !!b);
		if (!boxes.length) throw Error("选中的图层没有可导出的可见边界。");
		const scale = m.scale === 2 ? 2 : 1;
		const origin = {
			x: Math.min(...boxes.map((b) => b.x)),
			y: Math.min(...boxes.map((b) => b.y))
		};
		const width = Math.max(1, Math.round((Math.max(...boxes.map((b) => b.x + b.width)) - origin.x) * scale));
		const height = Math.max(1, Math.round((Math.max(...boxes.map((b) => b.y + b.height)) - origin.y) * scale));
		if (width > 3e4 || height > 3e4) throw Error("导出尺寸 " + width + " × " + height + " 超过 PSD 上限（30000 像素），请缩小范围或倍率。");
		const exportName = scope.length === 1 ? scope[0].name : page.name;
		const options = { skipHidden: !!m.skipHidden };
		const progress = { done: 0, skipped: [], shapes: [], shapeSkips: [], masks: [], maskFails: [], clips: [], fades: [] };
		const layers = [];
		for (const node of scope) {
			const item = await collectExport(node, origin, scale, options, progress);
			if (item) layers.push(item);
		}
		if (!layers.length) throw Error("没有可导出的图层，可能全部为隐藏节点或空容器。");
		let preview = null;
		if (m.reference !== false && scope.length === 1) {
			const box = exportBounds(scope[0]);
			if (box) {
				const bytes = await exportRaster(scope[0], scale);
				if (bytes) preview = {
					name: scope[0].name,
					left: Math.round((box.x - origin.x) * scale),
					top: Math.round((box.y - origin.y) * scale),
					width: Math.max(1, Math.round(box.width * scale)),
					height: Math.max(1, Math.round(box.height * scale)),
					bytes
				};
			}
		}
		psdUi.postMessage({
			type: "export-tree",
			width,
			height,
			scale,
			rasters: progress.done,
			name: exportName,
			report: {
				导出名称: exportName,
				画布: width + " × " + height + " 像素",
				导出倍率: scale + " 倍",
				图层范围: scope.length === 1 ? "选中容器：" + exportName : "当前页面：" + scope.length + " 个顶层对象",
				栅格化图层: progress.done,
				跳过的图层: progress.skipped,
				半透明图层: {
					数量: progress.fades.length,
					明细: progress.fades.slice(0, 40)
				},
				还原的形状图层: {
					数量: progress.shapes.length,
					明细: progress.shapes.slice(0, 80)
				},
				未还原的填充: progress.shapeSkips.slice(0, 80),
				还原的透明蒙版: {
					数量: progress.masks.length,
					明细: progress.masks.slice(0, 80)
				},
				未还原的蒙版: progress.maskFails.slice(0, 40),
				应用的容器裁剪: {
					数量: progress.clips.length,
					明细: progress.clips.slice(0, 80)
				},
				蒙版与裁剪: scanMaskStats(scope, !!m.skipHidden)
			},
			layers,
			preview
		});
	}

	async function handle(m) {
		if (m.type === "export-psd") {
			try {
				await exportDocument(m);
			} catch (e) {
				psdUi.postMessage({
					type: "export-error",
					message: e instanceof Error ? e.message : String(e)
				});
			}
			return;
		}
		if (m.type.startsWith("organize-")) {
			if (active) {
				psdUi.postMessage({
					type: "organize-result",
					error: "请等待 PSD 导入完成再整理区域。"
				});
				return;
			}
			await organize(m);
			return;
		}
		if (m.type === "init") {
			try {
				const fonts = (await mg.listAvailableFontsAsync()).map((f) => f.fontName).sort((a, b) => (a.family + a.style).localeCompare(b.family + b.style));
				const saved = await mg.clientStorage.getAsync("font-map") ?? {};
				psdUi.postMessage({
					type: "fonts",
					fonts,
					saved
				});
			} catch (e) {
				psdUi.postMessage({ type: "init-error", message: e instanceof Error ? e.message : String(e) });
			}
			return;
		}
		if (m.type === "locate") {
			const n = await mg.getNodeById(m.nodeId);
			if (n && "isVisible" in n) {
				mg.document.currentPage.selection = [n];
				scrollAndZoomIntoView([n]);
			}
			return;
		}
		if (m.type === "begin") {
			if (cancelledSessions.has(m.session)) throw new Error("已取消");
			if (active) throw new Error("已有导入正在进行。");
			const root = frame(mg.document.currentPage, m.document.name, {
				x: mg.viewport.center.x,
				y: mg.viewport.center.y,
				width: m.document.width,
				height: m.document.height
			});
			root.clipsContent = true;
			active = {
				id: m.session,
				root,
				roots: [root],
				document: m.document,
				options: m.options,
				nodes: /* @__PURE__ */ new Map(),
				origins: /* @__PURE__ */ new Map(),
				assets: /* @__PURE__ */ new Map(),
				results: [],
				started: Date.now(),
				cancelled: false,
				clips: /* @__PURE__ */ new Map(),
				warnings: m.document.warnings ?? []
			};
			const saved = await mg.clientStorage.getAsync("font-map") ?? {};
			await mg.clientStorage.setAsync("font-map", {
				...saved,
				...m.options.fonts
			});
			ensure(active);
			reply(m.session, m.type);
			return;
		}
		const s = active;
		if (!s || s.id !== m.session) return;
		ensure(s);
		if (m.type === "asset") {
			const t = m.tile;
			let hash = imageHashes.get(t.key);
			if (!hash) {
				hash = (await mg.createImage(new Uint8Array(t.bytes))).href;
				imageHashes.set(t.key, hash);
			}
			const key = `${m.id}:${m.kind}`, tiles = s.assets.get(key) ?? [];
			tiles.push({
				x: t.x,
				y: t.y,
				width: t.width,
				height: t.height,
				key: t.key,
				hash
			});
			s.assets.set(key, tiles);
		} else if (m.type === "layer") await layer(m.layer, s);
		else if (m.type === "warning") s.warnings.push(m.message);
		else if (m.type === "reference") {
			const tiles = s.assets.get("reference:image") ?? [];
			if (tiles.length) {
				const ref = frame(mg.document.currentPage, "PSD 原稿参考", {
					x: s.root.x + s.root.width + 100,
					y: s.root.y,
					width: s.document.width,
					height: s.document.height
				});
				s.roots.push(ref);
				images(ref, tiles, "原稿");
				ref.isLocked = true;
			} else s.warnings.push("未找到可用原稿预览。");
			s.assets.delete("reference:image");
		} else if (m.type === "finish") {
			const report = {
				version: 1,
				name: s.document.name,
				results: s.results,
				elapsedMs: Date.now() - s.started,
				skipped: m.skipped ?? 0,
				warnings: s.warnings
			};
			mg.document.currentPage.selection = [s.root];
			scrollAndZoomIntoView([s.root]);
			s.root.setPluginData("psd-import", JSON.stringify({
				version: 1,
				layers: report.results.length,
				elapsedMs: report.elapsedMs
			}));
			active = void 0;
			reply(m.session, m.type, { report });
			return;
		}
		reply(m.session, m.type);
	}
	var queue = Promise.resolve();
	psdOnMessage = (m) => {
		if (m.type === "organize-alpha-result") {
			receiveAlpha(m);
			return;
		}
		if (m.type === "cancel") {
			cancelledSessions.add(m.session);
			const s = active;
			if (s && s.id === m.session) s.cancelled = true;
			queue = queue.then(() => {
				const current = active;
				if (current && current.id === m.session) cleanup(current);
				psdUi.postMessage({
					type: "cancelled",
					session: m.session
				});
			});
			return;
		}
		queue = queue.then(() => handle(m)).catch((e) => {
			const s = active;
			if (s && s.id === m.session) cleanup(s);
			psdUi.postMessage({
				type: "error",
				session: m.session,
				replyTo: m.type,
				message: e instanceof Error ? e.message : String(e)
			});
		});
	};
	mg.on("close", () => {
		if (active) cleanup(active);
	});
	//#endregion
})();


export default {
  type: MessageType.PSD_TO_PLUGIN,
  handler: (message) => {
    if (message && typeof message.type === 'string' && psdOnMessage) psdOnMessage(message);
  }
};
