import { MSStoreDownloadFile } from "./types";

function buildProxyDownloadUrl(file: MSStoreDownloadFile): string {
  const params = new URLSearchParams({
    url: file.url,
    filename: file.name,
  });
  return `/api/msstore/download?${params.toString()}`;
}

export function getMSStoreDownloadHref(file: MSStoreDownloadFile): string {
  try {
    const parsed = new URL(file.url);
    if (parsed.protocol === "http:") {
      return buildProxyDownloadUrl(file);
    }
  } catch {
    return file.url;
  }

  return file.url;
}
