# MasterGo 插件（mg 版）接入 AIGW 生图模型 —— 小白施工方案

> 面向对象：知道怎么打开命令行、能照抄命令的人；不需要懂后端。
> 目标：在 MasterGo 插件（`Variant/mastergo`）里加一个「AI 生图」面板，输入文字 → 出图 → 一键放进画布。
> 结论先看：**插件不能直接调 AIGW，必须经过一个「中转服务」**。原因和第 3 节实测数据有关，照做就行。

---

## 一、先记住 5 个名词（大白话）

| 名词 | 大白话解释 |
| --- | --- |
| **mg 插件** | 就是本仓库 `Variant/mastergo` 这个 MasterGo 插件，界面用 Vue 写的，运行在 MasterGo 客户端里。 |
| **AIGW** | 公司内部的 AI 网关（大神 AI PROXY），地址 `https://aigw.ds.163.com`。它按标准 OpenAI 格式提供各种模型，这里用它的**生图模型**。 |
| **KEY** | 调用 AIGW 的通行证，格式长这样：`app_id.app_key`（一串字母数字，中间一个点）。没有它一律返回 401。 |
| **中转服务** | 一台能访问 AIGW 的服务器（或 n8n 工作流），替插件去调 AIGW，再把图片结果递回插件。**KEY 只存在这里，不写进插件。** |
| **CORS** | 浏览器的安全规则：A 网站要调 B 网站，必须 B 网站明确「允许」。不允许，浏览器直接拦掉，代码写得再对也没用。 |

---

## 二、最终效果长什么样（先对画面，再动手）

打开插件后，左侧主导航多一项 **「AI 生图」**，点进去是这样一个面板（从上到下）：

1. **提示词输入框**：多行文本框，占位提示「例如：一只简笔画风格的白色小猫，纯白背景」。
2. **参数行**：模型（下拉：`NanoBanana2 快速` / `NanoBanana Pro 精细`）、比例（1:1、4:3、16:9、9:16）、清晰度（1K / 2K）。
3. **生成按钮**：写着「生成图片」，点了以后按钮变成「生成中…（约 10 秒）」且不可重复点。
4. **结果区**：生成成功后出现图片缩略图；失败则出现一行中文红字原因。
5. **两个动作按钮**：`插入画布`（在视口中心生成一个矩形并填充这张图）、`填充选中`（把图填到你当前选中的矩形/画板里）。

交互约定：未选中图层时「填充选中」置灰并提示「请先在画布中选中一个矩形或画板」。

> 提醒：这一节描述的是**要做的界面**。等你做出来以后，必须自己打开 MasterGo 亲眼看一遍上述每个元素和状态，不能只看代码判断「应该没问题」。

---

## 三、为什么不能直连（2026-09-17 实测）

这两条是本方案的根据，别跳过：

1. **AIGW 不支持浏览器跨域**
   在本机执行预检请求（模拟插件的浏览器行为）：

   ```powershell
   curl.exe -s -i -X OPTIONS -H "Origin: https://mastergo.com" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type" https://aigw.ds.163.com/v1/chat/completions
   ```

   实测结果：`HTTP/1.1 401`，且响应头里**没有任何** `Access-Control-Allow-*`。
   含义：插件（跑在 `https://mastergo.com`）直接 fetch AIGW，浏览器会先发这个预检，预检被拒 → 请求根本发不出去。

2. **插件现在用的 n8n 中转是通的，而且已经配好了跨域**
   实测 `POST https://n8n.ds.163.com/webhook/mastergo-layout-admin-settings` 返回 `200`，响应头含：

   ```
   Access-Control-Allow-Origin: https://mastergo.com
   Access-Control-Allow-Methods: OPTIONS, POST
   Access-Control-Allow-Headers: content-type
   ```

   含义：**插件页面可以直接 fetch 这个 n8n**（插件现有的权限校验就是这么跑的）。所以「插件 → 中转 → AIGW」这条路最短。

3. **顺带一个好消息**：AIGW 网关本身在本机是可达的，无 KEY 才会 401。

   ```powershell
   curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" https://aigw.ds.163.com/v1/chat/completions
   # 输出 401 → 说明网络通、只是缺通行证
   ```

---

## 四、整体架构（一张图看懂）

```
MasterGo 插件界面（Vue，运行在 https://mastergo.com）
        │  ① fetch 中转地址（跨域，中转必须配 CORS）
        ▼
中转服务（n8n 工作流 或 自建 Node 小服务）
        │  ② fetch AIGW，带 Authorization: Bearer app_id.app_key
        ▼
AIGW：https://aigw.ds.163.com/v1/chat/completions
        │  ③ 返回 choices[0].message.image_urls = data:image/png;base64,...
        ▼
中转服务把 base64 原样回给插件
        ▼
插件：base64 → Uint8Array → postMessage 给插件主线程 → mg.createImage() → 填充图层/插入画布
```

分工记住一句话：**界面只负责问和显示，KEY 和跨域都归中转，画布写入归插件主线程。**

---

## 五、分步施工

### 步骤 1：拿到 KEY（半天内可完成）

1. 找 AIGW 的管理员/开通入口，申请一个应用，拿到 `app_id` 和 `app_key`。
2. 拼成一把 KEY：`你的app_id.你的app_key`（中间是英文点，不要空格）。
3. 把这把 KEY 存到密码管理器里，**不要**贴到聊天窗口、不要提交到 Git。

成功标志：你手上有形如 `abc123.def456ghi789` 的一串凭证。

### 步骤 2：先用命令行出第一张图（不写任何插件代码）

这一步是「先证明 KEY 能用」，能省掉后面 90% 的排查时间。

1. 新建一个文件 `body.json`，内容照抄（这就是 AIGW 生图的标准请求体）：

   ```json
   {
     "model": "gemini-3.1-flash-image",
     "stream": false,
     "messages": [
       {
         "role": "user",
         "content": [
           { "type": "text", "text": "一只简笔画风格的白色小猫，纯白背景" }
         ]
       }
     ],
     "vertexai": {
       "response_modalities": ["TEXT", "IMAGE"],
       "image_config": { "image_size": "1K", "aspect_ratio": "1:1" }
     }
   }
   ```

2. 在同一个目录打开 PowerShell，执行（把 `你的KEY` 换成步骤 1 的凭证）：

   ```powershell
   $key = "你的app_id.你的app_key"
   curl.exe -s -X POST https://aigw.ds.163.com/v1/chat/completions `
     -H "Content-Type: application/json" `
     -H "Authorization: Bearer $key" `
     --data "@body.json" -o result.json -w "HTTP %{http_code}  耗时 %{time_total}s`n"
   ```

3. 看结果 `result.json`：里面 `choices[0].message.image_urls[0]` 是一长串 `data:image/png;base64,...`。把它存成图片好眼熟一下：

   ```powershell
   $j = Get-Content result.json -Raw | ConvertFrom-Json
   $b64 = ($j.choices[0].message.image_urls[0] -split ',')[1]
   [IO.File]::WriteAllBytes("$PWD\first.png", [Convert]::FromBase64String($b64))
   Start-Process .\first.png
   ```

成功标志：屏幕上弹出一张 AI 生成的图，命令返回 `HTTP 200`，耗时大约 8～15 秒。

卡住怎么办：

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `HTTP 401` | KEY 写错、少了 `Bearer `、或者点号前后有空格 | 重拼 KEY，注意 `Bearer` 后面有一个空格 |
| `HTTP 400` | 请求体被改坏（少 `vertexai` 或模型名写错） | 严格照抄上面的 `body.json` |
| `HTTP 429` | 触发限流 | 等 1 分钟再试，别连点 |
| 返回里没有 `image_urls`，只有一段英文 | 触发了内容安全策略 | 换一个提示词 |
| 连接超时 | 本机网络到不了 AIGW | 换到内网机器再试 |

### 步骤 3：搭中转（两条路，先走 A）

#### 方案 A：用现成的 n8n（最快，0 台新服务器）

插件已经在用 `n8n.ds.163.com`，跨域也是通的，所以在这里加一个工作流最省事。

1. 打开 n8n，新建工作流，依次放 3 个节点：

   | 顺序 | 节点 | 关键设置 |
   | --- | --- | --- |
   | 1 | **Webhook** | HTTP Method 选 `POST`；Path 取 `mg-aigw-image`；Response Mode 选 `Using 'Respond to Webhook' Node` |
   | 2 | **HTTP Request** | Method `POST`；URL `https://aigw.ds.163.com/v1/chat/completions`；Send Headers 打开，加两条：`Authorization` = `Bearer {{你的KEY}}`、`Content-Type` = `application/json`；Body 选 JSON，把上面 `body.json` 的内容贴进去（提示词用 `={{ $json.body.prompt }}` 动态替换） |
   | 3 | **Respond to Webhook** | Respond With 选 `JSON`，Body 填 `={{ $json }}`（原样把 AIGW 的结果吐回去） |

2. 保存并激活，得到固定地址：`https://n8n.ds.163.com/webhook/mg-aigw-image`。

3. **务必让运维/网关放行三个跨域头**（这是最容易漏的一步）：
   `Access-Control-Allow-Origin: https://mastergo.com`、`Access-Control-Allow-Methods: POST, OPTIONS`、`Access-Control-Allow-Headers: content-type`。
   注意目前 n8n 网关只放行了 `content-type`，**没有放行 `authorization`** —— 所以插件的请求里**不要**带自定义头，KEY 只能放在 n8n 里，不要从插件传。

成功标志：用步骤 2 的 curl 换成打 `https://n8n.ds.163.com/webhook/mg-aigw-image`，同样能返回带 `image_urls` 的 JSON。

#### 方案 B：自建 Node 小服务（n8n 将来要下线时用）

- 一台能访问 `aigw.ds.163.com` 的机器（内网即可），Node 18+。
- 一个 `server.js`，做三件事：允许跨域（`Access-Control-Allow-Origin: https://mastergo.com`，并正确响应 `OPTIONS` 预检）、把前端传的 prompt 组装成 AIGW 请求体、用环境变量里的 KEY 转发请求。
- KEY 放环境变量 `AIGW_KEY`，写进 `.env`（`.env` 必须进 `.gitignore`）。
- 用 PM2 之类守护进程常驻，日志里**只记状态码和耗时，不记 prompt 全文和 KEY**。

成功标志：`curl` 打自己的服务地址，和方案 A 一样拿到 `image_urls`。

### 步骤 4：插件里加「AI 生图」面板

代码落点（照这个改，别自己另开一套结构）：

| 做什么 | 改哪个文件 |
| --- | --- |
| 新增消息类型（界面 ↔ 主线程） | `Variant/src/messages/messageType.ts`，加 `AI_IMAGE_INSERT = 'aiImageInsert'`、`AI_IMAGE_INSERT_RESULT = 'aiImageInsertResult'` |
| 新增界面页面 | 新建 `Variant/src/ui/pages/ai-image/index.vue`（提示词 + 参数 + 生成按钮 + 结果预览） |
| 新增中转调用 | 新建 `Variant/src/ui/pages/ai-image/aigwImage.ts`，只放一个方法：POST 中转地址 → 取出 `choices[0].message.image_urls` |
| 挂到左侧导航 | `Variant/src/ui/App.vue` 的 `navList` 里加一项 `{ name: 'AI 生图', pages: [{ name: '生图', component: AiImage }] }` |
| 主线程写入画布 | 新建 `Variant/mastergo/src/plugin/messages/ai/insert-image.ts`，复用 `Variant/mastergo/src/plugin/utils/image-utils.ts` 的 `fillTheSelection` |
| 注册主线程处理器 | `Variant/mastergo/src/plugin/index.ts` 里按现有写法 `import` 并注册新消息 |

界面里的关键几行（示意，别直接复制粘贴）：

```ts
// 1) 请求中转（KEY 不在这里，KEY 在中转服务上）
const resp = await fetch('https://n8n.ds.163.com/webhook/mg-aigw-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, model, ratio, size }),
});
const data = await resp.json();
const dataUrl: string = data?.choices?.[0]?.message?.image_urls?.[0] ?? '';

// 2) base64 → 字节数组，交给插件主线程
const base64 = dataUrl.split(',')[1];
const binary = atob(base64);
const bytes = new Array(binary.length);
for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
sendMsgToPlugin(MessageType.AI_IMAGE_INSERT, { bytes, name: 'AI生成图' });
```

主线程端（示意）：

```ts
const bytes = new Uint8Array(data.bytes);
const imageHandle = await mg.createImage(bytes);
// 有选中 → 填充选中图层；没选中 → 在视口中心建矩形再填充
```

**性能红线**：不要用 base64 字符串直接 postMessage 传大图，先转成字节数组再传（现有「批量延展」传图也是这个套路），否则会触发结构化克隆报错或卡顿。

### 步骤 5：联调与验收

按顺序过一遍，全绿才算完成：

- [ ] 命令行直连 AIGW 能出图（步骤 2）
- [ ] 中转地址能从浏览器/curl 出图（步骤 3）
- [ ] 插件面板能出缩略图，按钮在生成期间置灰
- [ ] 「插入画布」在视口中心得到一张图，尺寸与所选比例一致
- [ ] 「填充选中」能把图填进选中矩形；未选中时按钮置灰并有中文提示
- [ ] 失败路径有中文提示：401 / 429 / 超时 / 空白提示词，逐个用假 KEY 试一遍
- [ ] 开发者工具 Network 里**看不到**任何直连 `aigw.ds.163.com` 的请求（应该只打中转）
- [ ] 生成的图自己在 MasterGo 里亲眼看过一遍，清晰度和比例符合预期

### 步骤 6（可选，二期）：图生图与批量

- **图生图**：把参考图先上传到 AIGW 的 `/v1/files`，拿到 `https://aigw-file-link.netease.com/{id}`，再把这个地址塞进请求体 `content` 里（`{ "type": "image_url", "image_url": { "url": "..." } }`）。注意：这个 file-link 地址只能给 AIGW 读，**不能**用浏览器去访问。
- **批量**：多个提示词串行发（中间留 3～4 秒间隔），不要并发猛冲，容易触发 429。

---

## 六、模型怎么选（照这个填）

| 场景 | 模型名 | 说明 |
| --- | --- | --- |
| 快速草稿、验证链路（推荐先用它） | `gemini-3.1-flash-image` | 也叫 NanoBanana2，约 10 秒出图 |
| 精细成品、要画文字 | `gemini-3-pro-image` | NanoBanana Pro，慢一些、质量更高 |
| 需要 gpt-image 系列 | `gpt-image-2` | 走 DreamMaker 异步接口，要轮询任务状态，链路更复杂，二期再考虑 |

比例与清晰度对应请求体里的 `vertexai.image_config`：`image_size` 取 `1K` / `2K`，`aspect_ratio` 取 `1:1` / `4:3` / `16:9` / `9:16` 等。

---

## 七、三条不能碰的红线

1. **KEY 不进插件、不进 Git、不进日志**。只能放在中转服务的环境变量里。
2. **请求体不要自己发明字段**。AIGW 侧靠 `vertexai.response_modalities` 决定「要不要出图」，少了它可能只回文字不回图。
3. **别把内网地址当公网用**。`aigw-int.*` 系列在当前网段不可达，生产统一只用 `aigw.ds.163.com`。

---

## 八、工期参考

| 阶段 | 工作量 | 前置依赖 |
| --- | --- | --- |
| 步骤 1 拿 KEY | 半天 | 找管理员 |
| 步骤 2 命令行出图 | 半小时 | KEY |
| 步骤 3 中转（走 n8n） | 半天 | KEY + 网关放行跨域头 |
| 步骤 4 插件面板 | 1～2 天 | 中转地址 |
| 步骤 5 联调验收 | 半天 | 全部 |

---

## 附：参考实现（本项目外，但可直接抄思路）

公司 FlowX 项目里已有一套跑通的生产实现，遇到细节问题可以对照着看：

- `E:\KW\Git\FlowX\docs\n8n脱钩与AIGW直连方案.md`：AIGW 入口、网络与跨域注意事项（第九章附录有入口速查表）
- `E:\KW\Git\FlowX\scripts\test-aigw-nanobanana.mjs`：最小可运行的请求示例
- `E:\KW\Git\FlowX\flowx-api\shared\lib\server\toolConfigs.js` 的 `buildNanobananaAigwBody`：请求体怎么拼
- `E:\KW\Git\FlowX\flowx-api\shared\lib\server\toolConfigs\processImageResult.js`：响应里怎么把 base64 解出来（含「触发安全策略拦截」的判定）
