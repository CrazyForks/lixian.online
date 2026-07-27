import { expect, test } from "@playwright/test";
import {
  chromeExtensionId,
  dockerImage,
  edgeExtensionId,
  edgeExtensionUrl,
  mockChromeApis,
  mockDockerApis,
  mockEdgeApis,
  mockMsStoreApi,
  msstoreBlockMapFileName,
  msstoreFileName,
  msstoreHttpDownloadUrl,
  msstoreLastModifiedDate,
  mockVsCodeApi,
  msstoreDownloadUrl,
  msstoreProductId,
  msstoreProductUrl,
  vscodeExtensionUrl,
} from "./fixtures";

test("VSCode flow generates a direct VSIX link", async ({ page }) => {
  await mockVsCodeApi(page);

  await page.goto("/");

  await page.getByTestId("vscode-input").fill(vscodeExtensionUrl);
  await page.getByTestId("vscode-submit").click();

  await page.getByRole("button", { name: "选择版本" }).click();
  await page.getByRole("button", { name: "1.2.3" }).click();

  await expect(page.getByTestId("vscode-download-link")).toHaveAttribute(
    "href",
    "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/anthropic/vsextensions/claude-code/1.2.3/vspackage",
  );
});

test("Chrome flow prepares CRX and ZIP downloads", async ({ page }) => {
  await mockChromeApis(page);

  await page.goto("/");
  await page.getByTestId("tab-chrome").click();

  await page.getByTestId("chrome-input").fill(chromeExtensionId);
  await page.getByTestId("chrome-submit").click();

  await expect(page.getByText("uBlock Origin", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A fast and trusted content blocker."),
  ).toBeVisible();

  await page.getByTestId("chrome-download-both").click();

  await expect(page.getByTestId("chrome-download-crx-link")).toHaveAttribute(
    "download",
    `${chromeExtensionId}.crx`,
  );
  await expect(page.getByTestId("chrome-download-zip-link")).toHaveAttribute(
    "download",
    `${chromeExtensionId}.zip`,
  );
  await expect(page.getByTestId("chrome-download-crx-link")).toHaveAttribute(
    "href",
    /blob:/,
  );
  await expect(page.getByTestId("chrome-download-zip-link")).toHaveAttribute(
    "href",
    /blob:/,
  );
});

test("Edge flow resolves a store URL and prepares CRX and ZIP downloads", async ({
  page,
}) => {
  await mockEdgeApis(page);
  const detailRequest = page.waitForRequest((request) =>
    request.url().includes("/api/edge/detail"),
  );

  await page.goto("/");
  await page.getByTestId("tab-msedge").click();

  await page.getByTestId("edge-input").fill(edgeExtensionUrl);
  await page.getByTestId("edge-submit").click();

  const request = await detailRequest;
  expect(new URL(request.url()).searchParams.get("query")).toBe(edgeExtensionUrl);

  await expect(
    page.getByText("uBlock Origin Lite", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("开发者: Raymond Hill")).toBeVisible();
  await expect(page.getByText("分类: Productivity")).toBeVisible();

  await page.getByTestId("edge-download-both").click();

  await expect(page.getByTestId("edge-download-crx-link")).toHaveAttribute(
    "download",
    `${edgeExtensionId}.crx`,
  );
  await expect(page.getByTestId("edge-download-zip-link")).toHaveAttribute(
    "download",
    `${edgeExtensionId}.zip`,
  );
  await expect(page.getByTestId("edge-download-crx-link")).toHaveAttribute(
    "href",
    /blob:/,
  );
  await expect(page.getByTestId("edge-download-zip-link")).toHaveAttribute(
    "href",
    /blob:/,
  );
});

test("Edge flow offers search suggestions before resolving details", async ({
  page,
}) => {
  await mockEdgeApis(page);

  await page.goto("/");
  await page.getByTestId("tab-msedge").click();

  await page.getByTestId("edge-input").fill("ublock");
  await expect(
    page.getByText("uBlock Origin Lite", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /uBlock Origin Lite/ })
    .first()
    .click();
  await expect(page.getByTestId("edge-input")).toHaveValue(edgeExtensionId);

  await page.getByTestId("edge-submit").click();
  await expect(page.getByText("A permission-light content blocker for Edge.")).toBeVisible();
});

test("Docker flow prepares a docker load tarball", async ({ page }) => {
  await mockDockerApis(page);

  await page.goto("/");
  await page.getByTestId("tab-docker").click();

  await page.getByTestId("docker-input").fill(dockerImage);
  await page.getByTestId("docker-submit").click();

  await expect(page.getByText("选择版本")).toBeVisible();

  await page.getByTestId("docker-download").click();

  await expect(page.getByTestId("docker-download-link")).toHaveAttribute(
    "download",
    "library-nginx-latest.tar",
  );
  await expect(page.getByTestId("docker-download-link")).toHaveAttribute(
    "href",
    /blob:/,
  );
});

test("Docker flow tolerates invalid manifest layers", async ({ page }) => {
  await mockDockerApis(page, { includeInvalidLayer: true });

  await page.goto("/");
  await page.getByTestId("tab-docker").click();

  await page.getByTestId("docker-input").fill(dockerImage);
  await page.getByTestId("docker-submit").click();

  await expect(page.getByText("选择版本")).toBeVisible();
  await expect(page.getByText("镜像层（1 层）")).toBeVisible();

  await page.getByTestId("docker-download").click();

  await expect(page.getByTestId("docker-download-link")).toHaveAttribute(
    "download",
    "library-nginx-latest.tar",
  );
});

test("Docker flow supports ARM architecture selection", async ({ page }) => {
  await mockDockerApis(page);

  await page.goto("/");
  await page.getByTestId("tab-docker").click();

  await page.getByTestId("docker-input").fill(dockerImage);
  await page.getByTestId("docker-submit").click();

  await expect(page.getByText("选择版本")).toBeVisible();
  await expect(page.getByText("架构")).toBeVisible();

  // Switch to arm64
  await page.getByRole("button", { name: "linux/amd64" }).click();
  await page.getByRole("button", { name: "linux/arm64" }).click();

  await page.getByTestId("docker-download").click();

  await expect(page.getByTestId("docker-download-link")).toHaveAttribute(
    "download",
    "library-nginx-latest-arm64.tar",
  );
  await expect(page.getByTestId("docker-download-link")).toHaveAttribute(
    "href",
    /blob:/,
  );
});

test("Docker flow explains keyword-like image parse failures and lets users pick a candidate", async ({
  page,
}) => {
  await mockDockerApis(page, {
    missingImages: ["library/kafka"],
    searchResults: [
      {
        repo_name: "apache/kafka",
        short_description: "Apache Kafka is an open-source event streaming platform.",
        star_count: 1234,
        pull_count: 123456,
      },
    ],
  });

  await page.goto("/");
  await page.getByTestId("tab-docker").click();

  await page.getByTestId("docker-input").fill("kafka");
  await page.getByTestId("docker-submit").click();

  await expect(page.getByText("未找到对应镜像：library/kafka")).toBeVisible();
  await expect(
    page.getByText(/Docker 镜像不能按关键词直接解析/),
  ).toBeVisible();
  await expect(page.getByTestId("docker-candidate-apache-kafka")).toBeVisible();

  await page.getByTestId("docker-candidate-apache-kafka").click();
  await expect(page.getByTestId("docker-input")).toHaveValue("apache/kafka");

  await page.getByTestId("docker-submit").click();
  await expect(page.getByText("选择版本")).toBeVisible();
});

test("MSStore flow renders a download link from a store URL", async ({
  page,
}) => {
  await mockMsStoreApi(page);
  const resolveRequest = page.waitForRequest((request) =>
    request.url().includes("/api/msstore/resolve"),
  );

  await page.goto("/");
  await page.getByTestId("tab-msstore").click();

  await expect(page.getByRole("button", { name: "试试 Codex" })).toBeVisible();
  await expect(page.getByRole("button", { name: /试试 Python/ })).toHaveCount(0);
  await page.getByRole("button", { name: "试试 Codex" }).click();
  await expect(page.getByTestId("msstore-input")).toHaveValue(
    "https://apps.microsoft.com/detail/9plm9xgg6vks",
  );

  await page.getByTestId("msstore-input").fill(msstoreProductUrl);
  await page.getByTestId("msstore-submit").click();

  const request = await resolveRequest;
  const params = new URL(request.url()).searchParams;
  expect(params.get("type")).toBe("url");
  expect(params.get("query")).toBe(msstoreProductUrl);
  expect(params.get("market")).toBe("US");
  expect(params.get("language")).toBe("en-us");

  await expect(page.getByTestId("msstore-download-link")).toHaveAttribute(
    "href",
    msstoreDownloadUrl,
  );
  await expect(page.getByTestId("msstore-last-modified")).toHaveAttribute(
    "datetime",
    msstoreLastModifiedDate,
  );
  await expect(page.getByTestId("msstore-last-modified")).toContainText(
    "商店目录更新:",
  );

  await page.getByRole("button", { name: /Microsoft\.WindowsTerminal/ }).click();
  await expect(page.getByText("BlockMap")).toHaveCount(0);
  await expect(page.getByText(msstoreBlockMapFileName)).toHaveCount(0);
});

test("MSStore flow auto-detects a raw ProductId", async ({ page }) => {
  await mockMsStoreApi(page);
  const resolveRequest = page.waitForRequest((request) =>
    request.url().includes("/api/msstore/resolve"),
  );

  await page.goto("/");
  await page.getByTestId("tab-msstore").click();

  await page.getByTestId("msstore-input").fill(msstoreProductId);
  await page.getByTestId("msstore-submit").click();

  const request = await resolveRequest;
  const params = new URL(request.url()).searchParams;
  expect(params.get("type")).toBe("ProductId");
  expect(params.get("query")).toBe(msstoreProductId);

  await expect(page.getByTestId("msstore-download-link")).toBeVisible();
});

test("MSStore flow proxies HTTP download links through same-origin API", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockMsStoreApi(page, { downloadUrl: msstoreHttpDownloadUrl });

  await page.goto("/");
  await page.getByTestId("tab-msstore").click();

  await page.getByTestId("msstore-input").fill(msstoreProductUrl);
  await page.getByTestId("msstore-submit").click();

  const href = await page
    .getByTestId("msstore-download-link")
    .getAttribute("href");

  expect(href).toBe(
    `/api/msstore/download?${new URLSearchParams({
      url: msstoreHttpDownloadUrl,
      filename: msstoreFileName,
    }).toString()}`,
  );

  await expect(page.getByTestId("msstore-real-download-url")).toContainText(
    msstoreHttpDownloadUrl,
  );
  const copyPrecedesDownload = await page.evaluate(() => {
    const copyButton = document.querySelector(
      '[data-testid="msstore-copy-real-url"]',
    );
    const downloadLink = document.querySelector(
      '[data-testid="msstore-download-link"]',
    );
    return Boolean(
      copyButton &&
        downloadLink &&
        copyButton.compareDocumentPosition(downloadLink) &
          Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(copyPrecedesDownload).toBe(true);
  await page.getByTestId("msstore-copy-real-url").click();
  await expect(
    page.getByText("已复制真实下载地址", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(msstoreHttpDownloadUrl, { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(msstoreHttpDownloadUrl);
});

test("MSStore flow rejects unrecognized input without calling the API", async ({
  page,
}) => {
  await mockMsStoreApi(page);
  let resolveCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/msstore/resolve")) {
      resolveCalls += 1;
    }
  });

  await page.goto("/");
  await page.getByTestId("tab-msstore").click();

  await page.getByTestId("msstore-input").fill("not a valid input");
  await page.getByTestId("msstore-submit").click();

  await expect(page.getByText("解析失败").first()).toBeVisible();
  await expect(page.getByTestId("msstore-download-link")).toHaveCount(0);
  expect(resolveCalls).toBe(0);
});

test("VSCode history survives a page reload", async ({ page }) => {
  await mockVsCodeApi(page);

  await page.goto("/");

  await page.getByTestId("vscode-input").fill(vscodeExtensionUrl);
  await page.getByTestId("vscode-submit").click();
  await expect(page.getByRole("button", { name: "选择版本" })).toBeVisible();

  await page.reload();
  await page.getByTestId("vscode-input").focus();

  await expect(
    page.getByRole("button", { name: vscodeExtensionUrl }),
  ).toBeVisible();
});
