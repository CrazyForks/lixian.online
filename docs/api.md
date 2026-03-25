# Lixian.Online 接口文档

> 本文档覆盖项目中所有 API 接口（内部代理路由 + 上游外部 API），包含完整的请求/响应规格和可直接使用的 REST Client 示例。

---

## 1. 概述

### Base URL

- 开发环境：`http://localhost:3000`
- 生产环境：`https://lixian.online`

### 通用约定

- 所有内部 API 路由位于 `/api/` 前缀下
- 所有路由返回 CORS 头：`Access-Control-Allow-Origin: *`
- 所有路由实现 `OPTIONS` 预检响应
- 错误响应统一格式：`{ "error": "错误描述" }`
- 成功响应 HTTP 状态码为 `200`

### User-Agent

| 场景 | 值 |
|------|-----|
| 通用（tags/auth/manifest/search） | `Mozilla/5.0 (compatible; lixian.online/1.0)` |
| Chrome 扩展下载 | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36` |

---

## 2. Docker 接口

### 2.1 GET /api/docker/tags

获取 Docker 镜像的可用标签列表。

**上游：** `https://registry.hub.docker.com/v2/repositories/{namespace}/{repository}/tags?page_size=100`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `namespace` | string | 否 | `library` | Docker 命名空间 |
| `repository` | string | **是** | — | 仓库名称 |

#### 成功响应

```json
{
  "count": 100,
  "next": "https://...",
  "previous": null,
  "results": [
    {
      "name": "latest",
      "full_size": 67890,
      "last_updated": "2025-01-01T00:00:00Z"
    },
    {
      "name": "alpine",
      "full_size": 12345,
      "last_updated": "2025-01-01T00:00:00Z"
    }
  ]
}
```

> 客户端仅使用 `results[].name` 字段。

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | `repository` 参数缺失 |
| 404 | 镜像不存在（上游返回） |
| 500 | 服务器内部错误 |

#### 缓存

`Cache-Control: public, max-age=300`（5 分钟）

---

### 2.2 GET /api/docker/auth

获取 Docker Registry 认证令牌（匿名拉取权限）。

**上游：** `https://auth.docker.io/token?service=registry.docker.io&scope=repository:{namespace}/{repository}:pull`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `namespace` | string | 否 | `library` | Docker 命名空间 |
| `repository` | string | **是** | — | 仓库名称 |

#### 成功响应

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_token": "eyJ...",
  "expires_in": 300,
  "issued_at": "2025-01-01T00:00:00Z"
}
```

> 客户端仅使用 `token` 字段，作为后续 manifest/layer 请求的 Bearer 令牌。

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | `repository` 参数缺失 |
| 500 | 服务器内部错误 |

#### 缓存

`Cache-Control: public, max-age=1800`（30 分钟）

---

### 2.3 GET /api/docker/manifest

获取 Docker 镜像清单。如果是多架构清单（manifest list），自动选择 `amd64/linux` 并返回其具体清单。

**上游：** `https://registry-1.docker.io/v2/{namespace}/{repository}/manifests/{tag}`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `namespace` | string | 否 | `library` | Docker 命名空间 |
| `repository` | string | **是** | — | 仓库名称 |
| `tag` | string | 否 | `latest` | 镜像标签 |
| `token` | string | **是** | — | `/api/docker/auth` 返回的令牌 |

#### 上游请求头

```
Authorization: Bearer {token}
Accept: application/vnd.docker.distribution.manifest.v2+json
User-Agent: Mozilla/5.0 (compatible; lixian.online/1.0)
```

#### 多架构自动选择逻辑

当上游返回的 `mediaType` 为以下值时，触发自动选择：

- `application/vnd.docker.distribution.manifest.list.v2+json`
- `application/vnd.oci.image.index.v1+json`

在 `manifests[]` 中查找 `platform.architecture === "amd64" && platform.os === "linux"` 的条目，取其 `digest`，用 `https://registry-1.docker.io/v2/{repoPath}/manifests/{digest}` 重新请求。

#### 成功响应

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
  "config": {
    "mediaType": "application/vnd.docker.container.image.v1+json",
    "size": 5312,
    "digest": "sha256:e3b0c44298fc1c149afbf4c8996fb924..."
  },
  "layers": [
    {
      "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
      "size": 27092550,
      "digest": "sha256:a1b2c3d4e5f6..."
    },
    {
      "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
      "size": 1024000,
      "digest": "sha256:f6e5d4c3b2a1..."
    }
  ]
}
```

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | `repository` 缺失 |
| 401 | `token` 缺失 |
| 404 | 清单不存在，或多架构中未找到 amd64/linux |
| 500 | 服务器内部错误 |

#### 缓存

`Cache-Control: public, max-age=3600`（1 小时）

---

### 2.4 GET /api/docker/layer

下载 Docker 镜像的单个层（gzip 压缩的 tar 归档）。**流式传输**，不在服务端缓冲。

**上游：** `https://registry-1.docker.io/v2/{namespace}/{repository}/blobs/{digest}`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `namespace` | string | **是** | Docker 命名空间 |
| `repository` | string | **是** | 仓库名称 |
| `digest` | string | **是** | 层的 SHA256 摘要（`sha256:...`） |
| `token` | string | **是** | 认证令牌 |

#### 上游请求头

```
Authorization: Bearer {token}
Accept: application/vnd.docker.distribution.manifest.v2+json,
        application/vnd.docker.distribution.manifest.list.v2+json,
        application/vnd.oci.image.manifest.v1+json
```

#### 成功响应

- `Content-Type`：上游返回的原始类型（通常为 `application/octet-stream`）
- `Content-Length`：上游返回的原始长度
- Body：二进制流（gzip 压缩的 tar）

> 关键实现：直接将 `response.body`（ReadableStream）传入 `new NextResponse(response.body)`，实现零缓冲流式传输。

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | 任一必填参数缺失 |
| 502 | 上游返回空响应 |
| 500 | 服务器内部错误 |

#### 缓存

无（大文件不适合缓存）

---

### 2.5 GET /api/docker/search

搜索 Docker Hub 镜像。

**上游：** `https://hub.docker.com/v2/search/repositories/?query={q}&page_size={page_size}`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | **是** | — | 搜索关键词 |
| `page_size` | number | 否 | `5` | 结果数量（范围 1-100，服务端强制 clamp） |

#### page_size 校验逻辑

```javascript
const rawPageSize = Number(searchParams.get('page_size') || 5);
const pageSize = Number.isFinite(rawPageSize)
  ? Math.min(100, Math.max(1, Math.floor(rawPageSize)))
  : 5;
```

#### 成功响应

```json
{
  "count": 25,
  "next": "...",
  "previous": null,
  "results": [
    {
      "repo_name": "library/nginx",
      "short_description": "Official build of Nginx.",
      "star_count": 15000,
      "pull_count": 5000000,
      "is_official": true,
      "is_automated": false
    }
  ]
}
```

> 客户端使用 `results[]` 的 `repo_name`、`short_description`、`star_count`、`pull_count` 字段。`repo_name` 按 `/` 分割解析 namespace 和 repository（无 `/` 则 namespace 默认 `library`）。

#### 缓存

`Cache-Control: public, max-age=300`（5 分钟）

---

## 3. VSCode 接口

### 3.1 POST /api/vscode/query

查询 VSCode Marketplace 获取插件版本信息。

**上游：** `https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`

#### 上游请求头

```
Content-Type: application/json
Accept: application/json;api-version=3.0-preview.1
User-Agent: Mozilla/5.0 (compatible; lixian.online/1.0)
```

#### 请求体

客户端发送的 JSON 直接透传给上游。标准查询格式：

```json
{
  "filters": [
    {
      "criteria": [
        {
          "filterType": 7,
          "value": "ms-python.python"
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

**参数说明：**

| 字段 | 说明 |
|------|------|
| `filterType: 7` | 按扩展名（`publisher.extension`）精确查找 |
| `flags: 1` | `0x1` = 仅返回版本列表（不含文件/资产等重型元数据） |

#### 成功响应

```json
{
  "results": [
    {
      "extensions": [
        {
          "publisher": { "publisherName": "ms-python" },
          "extensionName": "python",
          "versions": [
            { "version": "2025.1.0", "lastUpdated": "..." },
            { "version": "2025.0.0", "lastUpdated": "..." },
            { "version": "2024.12.0", "lastUpdated": "..." }
          ]
        }
      ]
    }
  ]
}
```

> 客户端提取 `results[0].extensions[0].versions[].version`，去重后取前 20 个。

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 上游状态码 | 透传上游错误 |
| 500 | 代理请求失败 |

#### 缓存

无

---

### 3.2 VSCode 插件直接下载 URL（非代理）

版本选定后，客户端直接构建下载 URL（不经过 API 代理）：

```
https://marketplace.visualstudio.com/_apis/public/gallery/publishers/{publisher}/vsextensions/{extension}/{version}/vspackage
```

**示例：**
```
https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-python/vsextensions/python/2025.1.0/vspackage
```

该 URL 支持浏览器直接访问，返回 `.vsix` 文件。

---

## 4. Chrome 接口

### 4.1 GET /api/chrome/download

下载 Chrome 扩展的 CRX 文件。

**上游：** `https://clients2.google.com/service/update2/crx?{params}`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 32 位小写字母扩展 ID |

#### 扩展 ID 校验

```javascript
if (!/^[a-z]{32}$/.test(extensionId)) {
  return { error: '无效的扩展 ID 格式' }, 400;
}
```

#### 上游 URL 构建

```javascript
const params = new URLSearchParams({
  response: "redirect",
  os: "win",
  arch: "x64",
  os_arch: "x86_64",
  nacl_arch: "x86-64",
  prod: "chromecrx",
  prodchannel: "beta",
  prodversion: "131.0.6778.86",
  lang: "zh-CN",
  acceptformat: "crx2,crx3",
  x: `id=${extensionId}&installsource=ondemand&uc`
});
const url = `https://clients2.google.com/service/update2/crx?${params.toString()}`;
```

#### 上游请求头

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36
```

> 注意：此处使用完整的 Chrome 浏览器 UA，而非站点通用 UA。Chrome 更新服务会校验 UA。

#### 成功响应

- `Content-Type: application/x-chrome-extension`
- `Content-Disposition: attachment; filename="{extensionId}.crx"`
- Body：CRX 二进制文件（完整读取后返回，非流式）

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | ID 缺失或格式无效 |
| 404 | 扩展文件为空（已下架或不可用） |
| 上游状态码 | 透传上游错误 |
| 500 | 服务器内部错误 |

#### 缓存

`Cache-Control: public, max-age=3600`（1 小时）

---

### 4.2 GET /api/chrome/detail

获取 Chrome 扩展的名称和描述信息。通过抓取 Chrome Web Store 详情页 HTML 提取。

**上游：** `https://chromewebstore.google.com/detail/{extensionId}`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 32 位小写字母扩展 ID |

#### 上游请求头

```
User-Agent: Mozilla/5.0 (compatible; lixian.online/1.0)
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
```

#### HTML 解析逻辑

从服务端渲染的 HTML 中提取：

- **名称**：`<title>Extension Name - Chrome 应用商店</title>` → 正则 `/<title>(.+?)\s*[-–—]\s*Chrome[^<]*<\/title>/`
- **描述**：`<meta name="description" content="...">` → 正则 `/meta\s+name="description"\s+content="([^"]*)"/`

#### 成功响应

```json
{
  "id": "epcnnfbjfcgphgdmggkamkmgojdagdnn",
  "name": "uBlock",
  "description": "一款切实有效的广告拦截程序"
}
```

> `name` 和 `description` 可能为 `undefined`（页面结构变化时）。

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | ID 缺失或格式无效 |
| 上游状态码 | Chrome Web Store 错误 |
| 500 | 获取失败 |

#### 缓存

无

---

### 4.3 GET /api/chrome/search

搜索 Chrome Web Store 扩展。通过抓取搜索结果页 HTML 提取扩展列表。

**上游：** `https://chromewebstore.google.com/search/{encodeURIComponent(q)}`

#### 请求参数（Query String）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | **是** | 搜索关键词 |

#### 上游请求头

```
User-Agent: Mozilla/5.0 (compatible; lixian.online/1.0)
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
```

#### HTML 解析逻辑

从返回的 HTML 中使用正则提取扩展条目：

```javascript
const entryRegex = /detail\/([^/]+)\/([a-z]{32})/g;
// match[1] = slug (如 "ublock-origin-lite")
// match[2] = extension ID (32 位小写字母)
```

slug 转可读名称：
```javascript
slug.split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
// "ublock-origin-lite" → "Ublock Origin Lite"
```

去重（按 ID），最多返回 10 条。

#### 成功响应

```json
{
  "results": [
    {
      "id": "cjpalhdlnbpafiamejdnhcphjbkeiagm",
      "name": "Ublock Origin"
    },
    {
      "id": "fmkadmapgofadopljbjfkapdkoienihi",
      "name": "React Developer Tools"
    }
  ]
}
```

#### 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | 搜索关键词缺失 |
| 上游状态码 | Chrome Web Store 错误 |
| 500 | 搜索失败 |

#### 缓存

无

#### 客户端防抖

客户端对此接口的调用设有 400ms 防抖延迟。以下情况跳过搜索：
- 输入少于 2 个字符
- 输入匹配 `/^[a-z]{32}$/`（已是扩展 ID）
- 输入包含 `.` 或 `/`（可能是 URL）

---

## 5. 上游外部 API 参考

### 5.1 Docker Registry v2

| 端点 | 用途 |
|------|------|
| `https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull` | 匿名拉取令牌 |
| `https://registry-1.docker.io/v2/{repo}/manifests/{ref}` | 清单（tag 或 digest） |
| `https://registry-1.docker.io/v2/{repo}/blobs/{digest}` | 层二进制数据 |

### 5.2 Docker Hub

| 端点 | 用途 |
|------|------|
| `https://registry.hub.docker.com/v2/repositories/{ns}/{repo}/tags?page_size=N` | 标签列表 |
| `https://hub.docker.com/v2/search/repositories/?query=X&page_size=N` | 镜像搜索 |
| `https://hub.docker.com/r/{ns}/{repo}` | 仓库页面（用于外链） |

### 5.3 VSCode Marketplace

| 端点 | 用途 |
|------|------|
| `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery` | 扩展查询 |
| `GET https://marketplace.visualstudio.com/_apis/public/gallery/publishers/{pub}/vsextensions/{ext}/{ver}/vspackage` | 直接下载 .vsix |

### 5.4 Chrome Web Store / Update Service

| 端点 | 用途 |
|------|------|
| `https://clients2.google.com/service/update2/crx?{params}` | CRX 下载 |
| `https://chromewebstore.google.com/detail/{extensionId}` | 扩展详情页 HTML |
| `https://chromewebstore.google.com/search/{query}` | 搜索页面 HTML |

---

## 6. 类型定义速查

### 请求/响应类型映射

| 接口 | 客户端请求 | 客户端使用的响应字段 |
|------|-----------|---------------------|
| `GET /api/docker/tags` | `?namespace=&repository=` | `data.results[].name → string[]` |
| `GET /api/docker/auth` | `?namespace=&repository=` | `data.token → string` |
| `GET /api/docker/manifest` | `?namespace=&repository=&tag=&token=` | `data → DockerManifest` |
| `GET /api/docker/layer` | `?namespace=&repository=&digest=&token=` | `response.blob() → Blob` |
| `GET /api/docker/search` | `?q=&page_size=` | `data.results[] → { repo_name, short_description, star_count, pull_count }` |
| `POST /api/vscode/query` | JSON body | `data.results[0].extensions[0].versions[].version → string[]` |
| `GET /api/chrome/download` | `?id=` | `response.blob() → Blob` |
| `GET /api/chrome/detail` | `?id=` | `data → { id, name?, description? }` |
| `GET /api/chrome/search` | `?q=` | `data.results[] → ChromeSearchResult[]` |

---

## 附录：REST Client HTTP 文件

> 以下为 [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)（VSCode 扩展）格式的 `.http` 文件内容。可复制保存为 `docs/api.http` 直接使用。

```http
### ========================================
### Lixian.Online API - REST Client 测试文件
### ========================================

@baseUrl = http://localhost:3000


### ========================================
### Docker 接口
### ========================================

### 1. 获取镜像标签列表
GET {{baseUrl}}/api/docker/tags?namespace=library&repository=nginx

### 2. 获取认证令牌
GET {{baseUrl}}/api/docker/auth?namespace=library&repository=nginx

### 3. 获取镜像清单（需先获取 token）
# @name auth
GET {{baseUrl}}/api/docker/auth?namespace=library&repository=nginx

###
@token = {{auth.response.body.token}}
GET {{baseUrl}}/api/docker/manifest?namespace=library&repository=nginx&tag=latest&token={{token}}

### 4. 下载镜像层（需 token 和 digest）
# 将 digest 替换为 manifest 返回的实际值
GET {{baseUrl}}/api/docker/layer?namespace=library&repository=nginx&digest=sha256:a1b2c3d4e5f6&token={{token}}

### 5. 搜索 Docker 镜像
GET {{baseUrl}}/api/docker/search?q=nginx&page_size=5

### 搜索 - 自定义数量
GET {{baseUrl}}/api/docker/search?q=redis&page_size=10


### ========================================
### VSCode 接口
### ========================================

### 6. 查询插件版本列表
POST {{baseUrl}}/api/vscode/query
Content-Type: application/json

{
  "filters": [
    {
      "criteria": [
        {
          "filterType": 7,
          "value": "ms-python.python"
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

### 查询 ESLint 插件
POST {{baseUrl}}/api/vscode/query
Content-Type: application/json

{
  "filters": [
    {
      "criteria": [
        {
          "filterType": 7,
          "value": "dbaeumer.vscode-eslint"
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

### 7. 直接下载 VSCode 插件（非代理，浏览器直接访问）
# GET https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-python/vsextensions/python/2025.1.0/vspackage


### ========================================
### Chrome 接口
### ========================================

### 8. 获取扩展详情（名称、描述）
GET {{baseUrl}}/api/chrome/detail?id=cjpalhdlnbpafiamejdnhcphjbkeiagm

### 获取 uBlock 扩展详情
GET {{baseUrl}}/api/chrome/detail?id=epcnnfbjfcgphgdmggkamkmgojdagdnn

### 9. 下载 Chrome 扩展 (CRX)
GET {{baseUrl}}/api/chrome/download?id=cjpalhdlnbpafiamejdnhcphjbkeiagm

### 下载 React DevTools
GET {{baseUrl}}/api/chrome/download?id=fmkadmapgofadopljbjfkapdkoienihi

### 10. 搜索 Chrome 扩展
GET {{baseUrl}}/api/chrome/search?q=ublock

### 搜索 - 中文关键词
GET {{baseUrl}}/api/chrome/search?q=翻译


### ========================================
### 错误用例测试
### ========================================

### Docker tags - 缺少 repository
GET {{baseUrl}}/api/docker/tags?namespace=library

### Docker manifest - 缺少 token
GET {{baseUrl}}/api/docker/manifest?namespace=library&repository=nginx&tag=latest

### Chrome download - 无效 ID
GET {{baseUrl}}/api/chrome/download?id=invalid

### Chrome download - 缺少 ID
GET {{baseUrl}}/api/chrome/download

### Chrome search - 缺少关键词
GET {{baseUrl}}/api/chrome/search

### Docker search - 缺少关键词
GET {{baseUrl}}/api/docker/search
```
