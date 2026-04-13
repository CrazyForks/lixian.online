import { InputWithHistory } from "@/shared/ui/input-with-history";
import { Button } from "@/shared/ui/button";
import {
  SearchableSelect,
  SearchableSelectOption,
} from "@/shared/ui/searchable-select";
import { useToast } from "@/hooks/useToast";
import { useHistory } from "@/hooks/useHistory";
import { Card, CardContent } from "@/shared/ui/card";
import { LoadingSpinner } from "@/shared/ui/loading-spinner";
import { useMemo, useState } from "react";
import { Download, Package, ExternalLink } from "lucide-react";
import { useMSStoreDownloader } from "../hooks/useMSStoreDownloader";
import { MSStoreDownloadFile } from "../types";
import { getMSStoreDownloadHref } from "../download";

interface ParsedStoreFileName {
  component: string;
  version: string;
  architecture: string;
  architectureLabel: string;
  resourceId: string;
  publisherId: string;
  extension: string;
  typeLabel: string;
  isBlockMap: boolean;
}

interface FileOptionEntry {
  file: MSStoreDownloadFile;
  parsed: ParsedStoreFileName | null;
}

const ARCHITECTURE_LABEL: Record<string, string> = {
  x64: "x64",
  x86: "x86",
  arm64: "ARM64",
  arm: "ARM",
  neutral: "通用",
};

const FILE_TYPE_LABEL: Record<string, string> = {
  msixbundle: "MSIX Bundle",
  appxbundle: "APPX Bundle",
  msix: "MSIX",
  appx: "APPX",
  blockmap: "BlockMap",
  eappx: "EAPPX",
  eappxbundle: "EAPPX Bundle",
};

const STORE_PACKAGE_EXTENSIONS = new Set([
  "msixbundle",
  "appxbundle",
  "msix",
  "appx",
  "blockmap",
  "eappx",
  "eappxbundle",
]);

function parseStoreFileName(fileName: string): ParsedStoreFileName | null {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= fileName.length - 1) {
    return null;
  }

  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  if (!STORE_PACKAGE_EXTENSIONS.has(extension)) {
    return null;
  }
  const base = fileName.slice(0, dotIndex);
  const parts = base.split("_");

  if (parts.length < 5) {
    return null;
  }

  const publisherId = parts[parts.length - 1] ?? "";
  const resourceId = parts[parts.length - 2] ?? "";
  const architecture = (parts[parts.length - 3] ?? "").toLowerCase();
  const version = parts[parts.length - 4] ?? "";
  const component = parts.slice(0, parts.length - 4).join("_");

  if (!component || !version || !architecture) {
    return null;
  }

  return {
    component,
    version,
    architecture,
    architectureLabel: ARCHITECTURE_LABEL[architecture] ?? architecture,
    resourceId,
    publisherId,
    extension,
    typeLabel: FILE_TYPE_LABEL[extension] ?? extension.toUpperCase(),
    isBlockMap: extension === "blockmap",
  };
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const bParts = b.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const diff = (aParts[index] ?? 0) - (bParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function toFileOptionEntry(file: MSStoreDownloadFile): FileOptionEntry {
  const parsed = parseStoreFileName(file.name);
  return { file, parsed };
}

function sortFileEntries(entries: FileOptionEntry[]): FileOptionEntry[] {
  return [...entries].sort((a, b) => {
    const aName = a.parsed?.component ?? a.file.name;
    const bName = b.parsed?.component ?? b.file.name;
    if (aName !== bName) {
      return aName.localeCompare(bName);
    }

    const aVersion = a.parsed?.version ?? "";
    const bVersion = b.parsed?.version ?? "";
    const versionCompare = compareVersions(bVersion, aVersion);
    if (versionCompare !== 0) {
      return versionCompare;
    }
    return a.file.name.localeCompare(b.file.name);
  });
}

function toReadableOption(entry: FileOptionEntry): SearchableSelectOption {
  const parsed = entry.parsed;
  if (!parsed) {
    return {
      value: entry.file.name,
      label: `${entry.file.name} · ${entry.file.size}`,
    };
  }

  return {
    value: entry.file.name,
    label: `${parsed.component} · ${parsed.typeLabel} · ${parsed.architectureLabel} · v${parsed.version} · ${entry.file.size}`,
    keywords: [
      parsed.component,
      parsed.version,
      parsed.architecture,
      parsed.extension,
    ],
  };
}

interface MSStoreDownloaderProps {
  defaultValue?: string;
  onQueryChange?: (q: string) => void;
}

export default function MSStoreDownloader({
  defaultValue,
  onQueryChange: onQuerySync,
}: MSStoreDownloaderProps) {
  const { toast } = useToast();
  const history = useHistory("history:msstore");
  const {
    query,
    loading,
    result,
    placeholder,
    examples,
    onQueryChange,
    fillExample,
    handleSubmit,
  } = useMSStoreDownloader(defaultValue);
  const [selectedFileNameOverride, setSelectedFileNameOverride] = useState("");

  const fileEntries = useMemo(() => {
    return sortFileEntries((result?.files ?? []).map(toFileOptionEntry));
  }, [result?.files]);

  const fileOptions = useMemo(
    () => fileEntries.map((entry) => toReadableOption(entry)),
    [fileEntries],
  );

  const selectedFileName = useMemo(() => {
    if (fileEntries.length === 0) return "";
    if (
      fileEntries.some((entry) => entry.file.name === selectedFileNameOverride)
    ) {
      return selectedFileNameOverride;
    }
    return fileEntries[0].file.name;
  }, [fileEntries, selectedFileNameOverride]);

  const selectedFileEntry = useMemo(() => {
    if (fileEntries.length === 0) return null;
    return (
      fileEntries.find((entry) => entry.file.name === selectedFileName) ??
      fileEntries[0]
    );
  }, [fileEntries, selectedFileName]);
  const selectedFile = selectedFileEntry?.file ?? null;
  const selectedFileDownloadHref = selectedFile
    ? getMSStoreDownloadHref(selectedFile)
    : "";

  const onSubmit = async (e: React.FormEvent) => {
    try {
      await handleSubmit(e);
      history.add(query);
      onQuerySync?.(query);
      toast({
        title: "解析成功",
        description: "已获取产品信息和下载文件列表",
      });
    } catch (error) {
      toast({
        title: "解析失败",
        description: error instanceof Error ? error.message : "请求失败",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          输入 MS 应用链接，或前往
          <a
            href="https://apps.microsoft.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Microsoft Store
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <InputWithHistory
          data-testid="msstore-input"
          className="h-12"
          placeholder={placeholder}
          value={query}
          onChange={onQueryChange}
          history={history.items}
          onSelectHistory={(value) =>
            onQueryChange({
              target: { value },
            } as React.ChangeEvent<HTMLInputElement>)
          }
        />

        <div className="mt-1 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example.value}
              type="button"
              onClick={() => fillExample(example.value)}
              className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-apple-button transition-colors hover:bg-secondary hover:text-foreground"
            >
              试试 {example.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
        data-testid="msstore-submit"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner />
            解析中...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            解析应用信息
          </span>
        )}
      </Button>

      {result && (
        <>
          {fileEntries.length > 0 ? (
            <Card className="border border-emerald-500/35 bg-emerald-500/10 shadow-apple">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="rounded-apple border border-border/60 bg-background/70 p-3 shadow-apple-button">
                  <p className="mb-3 text-[11px] font-medium tracking-[0.08em] text-muted-foreground/80">
                    选择文件
                  </p>
                  <SearchableSelect
                    value={selectedFileName}
                    options={fileOptions}
                    placeholder="选择下载文件"
                    onValueChange={setSelectedFileNameOverride}
                  />
                </div>

                {selectedFile ? (
                  <div className="rounded-md border border-border/60 bg-background/60 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0 sm:items-center">
                        <div className="flex-shrink-0 w-9 h-9 rounded-apple-sm bg-primary/10 flex items-center justify-center">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground break-all">
                            {selectedFileEntry?.parsed?.component ??
                              selectedFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 break-all">
                            {selectedFileEntry?.parsed
                              ? `${selectedFileEntry.parsed.typeLabel} · ${selectedFileEntry.parsed.architectureLabel} · v${selectedFileEntry.parsed.version}`
                              : "安装包"}{" "}
                            · {selectedFile.size}
                          </p>
                          <p className="text-[11px] text-muted-foreground/90 mt-1 break-all">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground/90 mt-1 break-all">
                            哈希: {selectedFile.sha1 || "-"}
                          </p>
                        </div>
                      </div>
                      <a
                        href={selectedFileDownloadHref}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex-shrink-0 sm:w-auto"
                        data-testid="msstore-download-link"
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 sm:w-auto"
                        >
                          <Download className="h-3.5 w-3.5" />
                          下载
                        </Button>
                      </a>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {result.filesError ? (
            <Card className="border border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-xs text-amber-700 dark:text-amber-300">
                下载列表解析失败: {result.filesError}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </form>
  );
}
