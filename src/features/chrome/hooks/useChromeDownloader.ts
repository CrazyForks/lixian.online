import { useState, useCallback, useRef, useEffect } from "react";
import { chromeService } from "../api/ChromeService";
import { ChromeExtensionInfo, ChromeDownloadProgress, ChromeSearchResult } from "../types";

export function useChromeDownloader() {
  const [extensionUrl, setExtensionUrl] = useState("");
  const [extensionInfo, setExtensionInfo] = useState<ChromeExtensionInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<ChromeDownloadProgress | null>(null);
  const [downloadUrls, setDownloadUrls] = useState<{crx?: string; zip?: string}>({});
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<ChromeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Track active blob URLs so they can be revoked on re-download or unmount
  const blobUrlsRef = useRef<string[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const onUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setExtensionUrl(newUrl);
    
    // 实时解析扩展ID
    try {
      const id = chromeService.extractExtensionId(newUrl);
      if (id && chromeService.isValidExtensionId(id)) {
        setExtensionInfo({
          id,
          name: "Chrome Extension",
          version: "Unknown"
        });
      } else {
        setExtensionInfo(null);
      }
    } catch {
      setExtensionInfo(null);
    }
    
    // 清除之前的下载链接
    setDownloadUrls({});
    setDownloadProgress(null);
  }, []);

  // 搜索 Chrome 扩展
  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    // 如果输入的已经是扩展 ID，不搜索
    if (/^[a-z]{32}$/.test(trimmed)) {
      setSearchResults([]);
      return;
    }

    // 如果输入的是 URL（包含 . 或 / ），不搜索
    if (/[./]/.test(trimmed)) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await chromeService.searchExtensions(trimmed);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // debounce search
  const onSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUrlChange(e);
    const val = e.target.value;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => handleSearch(val), 400);
  }, [onUrlChange, handleSearch]);

  const selectSearchResult = useCallback((result: ChromeSearchResult) => {
    setExtensionUrl(result.id);
    setExtensionInfo({
      id: result.id,
      name: result.name,
      version: "Unknown",
    });
    setSearchResults([]);
    setDownloadUrls({});
    setDownloadProgress(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setSearchResults([]);

      try {
        if (!extensionUrl) {
          throw new Error("请输入 Chrome 扩展名称或 ID");
        }

        const extensionId = chromeService.extractExtensionId(extensionUrl);
        if (!chromeService.isValidExtensionId(extensionId)) {
          throw new Error("无效的扩展 ID");
        }

        // 获取扩展信息
        const info = await chromeService.getExtensionInfo(extensionId);
        setExtensionInfo(info);

      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [extensionUrl]
  );

  const handleDownload = useCallback(async (format: 'crx' | 'zip' | 'both' = 'both') => {
    if (!extensionInfo?.id) {
      throw new Error("请先解析扩展信息");
    }

    setLoading(true);
    setDownloadProgress({
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0
    });

    try {
      const downloadInfo = chromeService.getDownloadInfo(extensionInfo.id);
      
      // 下载 CRX 文件
      setDownloadProgress(prev => prev ? { ...prev, status: 'downloading' } : null);
      
      const response = await fetch(downloadInfo.downloadUrl);
      if (!response.ok) {
        let errorMessage = `下载失败: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch { /* ignore */ }
        throw new Error(errorMessage);
      }

      const crxBlob = await response.blob();

      // Revoke previous blob URLs before creating new ones
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      blobUrlsRef.current = [];

      const crxUrl = URL.createObjectURL(crxBlob);
      blobUrlsRef.current.push(crxUrl);

      const urls: {crx?: string; zip?: string} = {};
      
      if (format === 'crx' || format === 'both') {
        urls.crx = crxUrl;
      }

      if (format === 'zip' || format === 'both') {
        setDownloadProgress(prev => prev ? { ...prev, status: 'converting' } : null);
        try {
          const zipBlob = await chromeService.convertCrxToZip(crxBlob);
          const zipUrl = URL.createObjectURL(zipBlob);
          blobUrlsRef.current.push(zipUrl);
          urls.zip = zipUrl;
        } catch (error) {
          console.warn('CRX 转 ZIP 失败:', error);
          if (!urls.crx) urls.crx = crxUrl;
          if (format === 'zip') urls.crx = crxUrl;
        }
      }

      setDownloadUrls(urls);
      setDownloadProgress(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);

    } catch (error) {
      setDownloadProgress(prev => prev ? {
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : '下载失败'
      } : null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [extensionInfo]);

  return {
    extensionUrl,
    extensionInfo,
    downloadProgress,
    downloadUrls,
    loading,
    searchResults,
    searching,
    onUrlChange: onSearchInputChange,
    selectSearchResult,
    handleSubmit,
    handleDownload,
  };
}
