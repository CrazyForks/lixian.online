# Lixian.Online 实现规格

> 本文档描述当前代码库中的实际实现行为，用于和 `README.md`、`README.zh.md`、`CLAUDE.md` 保持一致。

## 1. 产品定义

Lixian.Online 是一个面向受限网络环境的 Web 工具，帮助用户获取以下四类公开资源的离线安装包或可下载链接：

| 能力 | 输入 | 输出 |
| --- | --- | --- |
| VSCode 插件 | Marketplace 插件页 URL | `.vsix` 直接下载链接 |
| Chrome 扩展 | 扩展名称、扩展 ID、商店 URL | `.crx` 和/或 `.zip` Blob 下载链接 |
| Docker 镜像 | 镜像名、镜像引用、Docker Hub URL | `docker load` 可导入的 `.tar` Blob 下载链接 |
| Microsoft Store | 商店 URL、`ProductId`、`PackageFamilyName`、`CategoryId` | 安装包下载链接 |

系统由两部分组成：

- 浏览器端应用：负责输入解析、状态管理、二进制处理、Blob URL 管理和下载按钮展示。
- Next.js API 路由：负责访问上游服务、处理 CORS / 鉴权、以及在需要时代理文件流。

## 2. 路由与页面骨架

### 2.1 路由

- `/` 会重定向到 `/${defaultTab}`。
- `defaultTab` 当前为 `vscode`。
- 合法 tab 由 `src/features/registry.ts` 定义，当前为：
  - `vscode`
  - `chrome`
  - `docker`
  - `msstore`
- 非法 tab 返回 404。

### 2.2 Query 同步

- 页面首次渲染时，会从 URL 的 `?q=` 读取默认输入值，并只传给当前激活的 tab。
- 每个功能在成功解析后，都会通过 `onQueryChange` 把当前输入同步回 `?q=`。
- 切换 tab 时，客户端会把路径替换为 `/{tab}`；当前实现不会保留原有查询字符串。

### 2.3 页面结构

页面主结构由 `src/app/[tab]/tab-page.tsx` 提供，包含：

- 标题 `Lixian Online`
- 一行站点描述，取自 `src/shared/lib/site.ts`
- 四个标签页按钮
- 当前功能的表单区域
- 底部版本号和 GitHub 外链

版本信息来自以下环境变量，均提供兜底值：

- `NEXT_PUBLIC_APP_VERSION`，默认 `0.1.0`
- `NEXT_PUBLIC_BUILD_TIME`，默认 `unknown`
- `NEXT_PUBLIC_COMMIT_HASH`，默认 `unknown`

## 3. 共享行为

### 3.1 动态加载与状态保留

- 各功能组件通过 `next/dynamic(..., { ssr: false })` 动态加载。
- 所有 tab 面板都会被渲染，只是非激活项通过 `hidden` 隐藏。
- 因此，在同一页面会话内切换标签时，各 tab 的内存状态会被保留。

### 3.2 Toast

- 全局 toast 由 `src/hooks/useToast.ts` 管理。
- 当前只允许同时显示 1 条 toast。
- toast 默认约 5 秒后移除。

### 3.3 输入历史

最近输入保存在 `localStorage` 中：

| 功能 | key |
| --- | --- |
| VSCode | `history:vscode` |
| Chrome | `history:chrome` |
| Docker | `history:docker` |
| MSStore | `history:msstore` |

规则如下：

- 最多保留 10 条。
- 写入前会做 `trim()`。
- 空字符串不会保存。
- 与已有完全相同的值会前移去重。
- 历史下拉的筛选逻辑为不区分大小写的包含匹配。

### 3.4 Blob URL 生命周期

- Chrome 下载结果通过 Blob URL 暴露。
- Docker 打包结果通过 Blob URL 暴露。
- 重新下载前会撤销旧的 Blob URL。
- 组件卸载时也会撤销仍然存活的 Blob URL。

## 4. 功能规格

### 4.1 VSCode 插件

#### 4.1.1 输入与解析

- 输入框只面向 VSCode Marketplace 插件链接。
- 解析逻辑读取 URL 中的 `itemName`。
- `itemName` 需形如 `publisher.extension`。
- 分割时使用最后一个 `.`，以兼容带 `.` 的 publisher。

错误语义：

- 无法构造 URL 时，输入阶段静默返回空结构，不直接报错。
- 缺少 `itemName` 时，抛出“无效的插件 URL，示例：...”
- `itemName` 中没有 `.` 时，抛出“无效的插件 ID 格式，应为 publisher.extension”

#### 4.1.2 版本查询

提交后，客户端调用 `POST /api/vscode/query`，请求体固定为：

```json
{
  "filters": [
    {
      "criteria": [
        {
          "filterType": 7,
          "value": "publisher.extension"
        }
      ],
      "pageNumber": 1,
      "pageSize": 1,
      "sortBy": 0,
      "sortOrder": 0
    }
  ],
  "flags": 1
}
```

版本提取规则：

- 从 `results[0].extensions[0].versions[].version` 读取
- 过滤空值
- 用 `Set` 去重，保留首次出现顺序
- 最多保留前 20 个版本

如果未找到扩展，报错“未找到该插件，请检查 URL 是否正确”。

#### 4.1.3 下载

- 查询成功后，UI 显示版本选择器。
- 只有选定版本后，下载卡片才会出现。
- 最终链接模板为：

```text
https://marketplace.visualstudio.com/_apis/public/gallery/publishers/{publisher}/vsextensions/{extension}/{version}/vspackage
```

- `.vsix` 最终下载不经过本站代理。

### 4.2 Chrome 扩展

#### 4.2.1 输入与搜索

输入支持三类内容：

- 扩展名称
- 32 位扩展 ID
- Chrome Web Store URL

搜索逻辑：

- 输入变化后会做 400ms 防抖。
- 当满足以下任一条件时，不发起搜索：
  - `trim()` 后长度小于 2
  - 输入看起来已经是 32 位小写字母 ID
  - 输入中包含 `.` 或 `/`
- 其余情况调用 `GET /api/chrome/search?q=...`

#### 4.2.2 ID 提取与详情

提交时：

- 先用正则 `([a-z]{32})` 在整段输入中查找扩展 ID。
- 如果整段输入本身是 32 位字母，会按小写接受。
- 无法得到合法 ID 时，报错“无效的 Chrome 扩展 URL 或 ID”。

解析到 ID 后，客户端调用 `GET /api/chrome/detail?id={id}`：

- 成功时显示 `name`、`description`、`id`
- 失败时降级为仅保留 `id`，不阻止下载流程继续

#### 4.2.3 下载与取消

UI 提供 3 个下载动作：

- `CRX`
- `ZIP`
- `全部下载`

下载逻辑：

1. 调用 `GET /api/chrome/download?id={id}` 获取 CRX。
2. 若响应具备 `Content-Length` 且可读取流，则按字节更新进度。
3. 若无法获得长度，则退化为阶段性进度。
4. 选择 `ZIP` 或 `全部下载` 时，在浏览器中执行 CRX 转 ZIP。
5. 为准备好的结果创建 Blob URL。

取消逻辑：

- 下载中可点击取消按钮。
- 取消会中止当前 `fetch`，清空当前进度并结束加载状态。

#### 4.2.4 CRX 转 ZIP

客户端按以下顺序处理：

- 若文件前两个字节是 `PK`，视为 ZIP，直接返回 ZIP Blob。
- 若魔数为 `Cr24`：
  - `version === 3` 时按 CRX3 头解析 ZIP 偏移量
  - `version === 2` 时按 CRX2 头解析 ZIP 偏移量
- 若不是 CRX，则在前 1024 字节内查找 `PK` 作为 ZIP 起点
- 若仍找不到 ZIP 魔数，则把原文件当作 ZIP/原始文件回退
- 若转换过程中抛错，则最终回退为原始 CRX Blob

### 4.3 Docker 镜像

#### 4.3.1 输入解析

支持以下格式：

- `nginx:latest`
- `library/nginx`
- `library/nginx:latest`
- `docker.io/library/nginx:latest`
- `hub.docker.com/r/library/nginx`

默认值：

- 默认 registry：`docker.io`
- 单段镜像名默认 namespace：`library`
- 未显式指定 tag 时默认：`latest`

#### 4.3.2 标签与候选镜像

提交后：

- 客户端先调用 `GET /api/docker/tags?namespace={namespace}&repository={repository}`
- 若返回空数组，或请求以 404 结束，则调用 `GET /api/docker/search?q=...&page_size=5`
- UI 会展示候选镜像链接和 Docker Hub 搜索入口

#### 4.3.3 Manifest

标签解析完成后：

- 客户端会预取 manifest，用于展示镜像层列表和总压缩大小
- 预取流程为：
  - `GET /api/docker/auth`
  - `GET /api/docker/manifest`

`/api/docker/manifest` 的行为：

- 支持 schema2 manifest 和 OCI manifest
- 若上游返回 manifest list / OCI index，则固定选择 `linux/amd64`
- 若找不到 `linux/amd64`，返回 404

客户端还会对 manifest 做一次归一化：

- 过滤掉缺少 `digest` 的无效 layer
- 为 layer 填补缺省 `mediaType` / `size`

#### 4.3.4 下载与打包

下载按钮触发后：

1. 若内存中已有预取 manifest，则直接复用，否则重新获取。
2. 对每一层下载前都会重新调用 `/api/docker/auth` 获取 token，避免长时间下载时 token 过期。
3. 每层通过 `GET /api/docker/layer` 流式下载。
4. 所有层下载完成后，在浏览器内生成 `docker load` 兼容 TAR。

打包细节：

- gzip layer 用 `DecompressionStream("gzip")` 解压
- zstd layer 明确报错“当前版本暂不支持”
- 其余未知/未压缩 layer 按原始数据透传
- 解压后对 layer tar 计算 SHA-256，作为 `rootfs.diff_ids`
- TAR 中包含：
  - `manifest.json`
  - `{imageId}.json`
  - 每层目录下的 `VERSION`、`json`、`layer.tar`

当前下载文件名采用 UI 中的 `{repository}-{tag}.tar`。

### 4.4 Microsoft Store

#### 4.4.1 输入类型识别

客户端支持：

- Microsoft Store URL
- `ProductId`（12 位字母数字）
- `PackageFamilyName`
- `CategoryId`（UUID）

识别优先级：

- URL 或明显的 Microsoft Store 域名片段 => `url`
- UUID => `CategoryId`
- `xxx_xxx` 形式 => `PackageFamilyName`
- 12 位字母数字 => `ProductId`

无法识别时，报错：

```text
无法识别输入类型，请输入 Microsoft Store 链接、ProductId（12 位）、PackageFamilyName 或 CategoryId（UUID）
```

#### 4.4.2 默认参数

当前客户端固定使用：

- `market=US`
- `language=en-us`

原因是全球目录覆盖率更高，能减少某些仅国际发布应用在其他市场下返回空结果的问题。

#### 4.4.3 解析流程

提交后，客户端调用：

```text
GET /api/msstore/resolve?type={type}&query={query}&market=US&language=en-us
```

服务端行为：

- 先规范化输入
- 再请求 `store.rg-adguard.net` 获取安装包文件列表
- 对于可提取到 BigId 的场景，同时请求微软 display catalog 获取产品元数据
- 如果 metadata 和 files 都拿不到，则返回 404
- 如果 metadata 存在但文件列表解析失败，则仍返回 metadata，并附带 `filesError`

返回结构包含：

- `productId`
- `title`
- `publisherName`
- `description`
- `packageFamilyNames`
- `market`
- `language`
- `categoryId`
- `files`
- `filesSource`
- `filesError`
- `skus`

#### 4.4.4 文件选择与下载

UI 行为：

- 若 `files` 存在，会先根据文件名解析组件名、版本、架构、扩展名
- 然后按组件名、版本号倒序、文件名排序
- 默认选中排序后的第一项
- 通过 `SearchableSelect` 让用户切换目标文件

下载链接规则：

- HTTPS 文件链接直接使用上游地址
- HTTP 文件链接会改写为：

```text
/api/msstore/download?url={upstreamUrl}&filename={fileName}
```

- 只有以下域名允许走 HTTP 代理：
  - `download.microsoft.com`
  - `*.dl.delivery.mp.microsoft.com`

## 5. API 路由契约

### 5.1 `POST /api/vscode/query`

- 作用：代理 VSCode Marketplace `extensionquery`
- 请求体：原样透传 JSON
- 上游：
  - `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`

### 5.2 `GET /api/chrome/search?q=...`

- 作用：抓取 Chrome Web Store 搜索页，提取最多 10 条候选扩展
- 缺少 `q` 返回 400
- 结果字段：
  - `results[].id`
  - `results[].name`

### 5.3 `GET /api/chrome/detail?id=...`

- 作用：抓取扩展详情页的标题与描述
- `id` 必须是 32 位小写字母，否则 400
- 返回：
  - `id`
  - `name`
  - `description`

### 5.4 `GET /api/chrome/download?id=...`

- 作用：代理 Chrome update service 返回 CRX
- `id` 缺失或格式错误返回 400
- 成功时返回 `application/x-chrome-extension`

### 5.5 `GET /api/docker/tags`

参数：

- `namespace`，可省略，默认 `library`
- `repository`，必填

作用：代理 Docker Hub tag 列表。

### 5.6 `GET /api/docker/search`

参数：

- `q`，必填
- `page_size`，可选，默认 5，服务端会夹到 `1..100`

作用：代理 Docker Hub 仓库搜索。

### 5.7 `GET /api/docker/auth`

参数：

- `namespace`，可省略，默认 `library`
- `repository`，必填

作用：向 Docker Hub 认证服务获取匿名 pull token。

### 5.8 `GET /api/docker/manifest`

参数：

- `namespace`，可省略，默认 `library`
- `repository`，必填
- `tag`，可省略，默认 `latest`
- `token`，必填

作用：获取指定 tag 的 manifest；若为 manifest list / OCI index，则解析到 `linux/amd64` 的具体 manifest。

### 5.9 `GET /api/docker/layer`

参数：

- `namespace`
- `repository`
- `digest`
- `token`

四个参数均必填。该接口会直接把上游 layer body 流式转发给浏览器。

### 5.10 `GET /api/msstore/resolve`

参数：

- `type`：`url` | `ProductId` | `PackageFamilyName` | `CategoryId`
- `query`
- `market`：默认 `US`
- `language`：默认 `en-us`
- `ring`：默认 `RP`

作用：组合微软 display catalog 和 `store.rg-adguard.net` 的解析结果。

### 5.11 `GET /api/msstore/download`

参数：

- `url`：必填，且必须是允许代理的 HTTP 下载链接
- `filename`：可选

作用：把允许代理的 HTTP Microsoft 下载地址转成同源下载流，保留常见响应头。

## 6. 测试与验证

E2E 测试位于 `tests/e2e/`，当前覆盖：

- VSCode 流程能生成正确的 `.vsix` 直链
- Chrome 流程能准备 CRX 和 ZIP Blob 下载链接
- Docker 流程能生成 `docker load` 兼容 TAR
- Docker manifest 中出现无效 layer 时，客户端仍能容错
- MSStore 能从 URL 和 ProductId 解析下载文件
- MSStore 的 HTTP 下载链接会回退到同源代理
- 无法识别的 MSStore 输入不会触发接口请求
- VSCode 历史记录在刷新后仍可见
