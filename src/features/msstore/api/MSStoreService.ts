import {
  MSStoreOption,
  MSStoreRequestType,
  MSStoreResolveParams,
  MSStoreResolveResult,
} from "../types";
import { get } from "@/shared/lib/http";

const TYPE_OPTIONS: MSStoreOption<MSStoreRequestType>[] = [
  { value: "url", label: "URL 链接" },
  { value: "ProductId", label: "ProductId" },
  { value: "PackageFamilyName", label: "PackageFamilyName" },
  { value: "CategoryId", label: "CategoryId" },
];

const PLACEHOLDERS: Record<MSStoreRequestType, string> = {
  url: "https://apps.microsoft.com/detail/9n0dx20hk701?hl=zh-CN&gl=CN",
  ProductId: "9N0DX20HK701",
  PackageFamilyName: "Microsoft.WindowsTerminal_8wekyb3d8bbwe",
  CategoryId: "d58c3a5f-ca63-4435-842c-7814b5ff91b7",
};

const EXAMPLES: Record<MSStoreRequestType, string[]> = {
  url: ["https://apps.microsoft.com/detail/9n0dx20hk701?hl=zh-CN&gl=CN"],
  ProductId: ["9N0DX20HK701", "9NKSQGP7F2NH"],
  PackageFamilyName: ["Microsoft.WindowsTerminal_8wekyb3d8bbwe"],
  CategoryId: ["d58c3a5f-ca63-4435-842c-7814b5ff91b7"],
};

class MSStoreService {
  private readonly market = "CN";

  private readonly language = "zh-cn";

  getTypeOptions(): MSStoreOption<MSStoreRequestType>[] {
    return TYPE_OPTIONS;
  }

  getPlaceholder(type: MSStoreRequestType): string {
    return PLACEHOLDERS[type];
  }

  getExamples(type: MSStoreRequestType): string[] {
    return EXAMPLES[type];
  }

  validateParams(params: MSStoreResolveParams): void {
    const value = params.query.trim();
    if (!value) {
      throw new Error("请输入要解析的内容");
    }

    switch (params.type) {
      case "url":
        return;
      case "ProductId":
        if (!/^[A-Za-z0-9]{12}$/.test(value)) {
          throw new Error("ProductId 格式有误，示例：9N0DX20HK701");
        }
        return;
      case "PackageFamilyName":
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*_[A-Za-z0-9]+$/.test(value)) {
          throw new Error(
            "PackageFamilyName 格式有误，示例：Microsoft.WindowsTerminal_8wekyb3d8bbwe",
          );
        }
        return;
      case "CategoryId":
        if (
          !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
            value,
          )
        ) {
          throw new Error(
            "CategoryId 格式有误，示例：d58c3a5f-ca63-4435-842c-7814b5ff91b7",
          );
        }
        return;
      default:
        throw new Error("不支持的请求类型");
    }
  }

  async resolve(params: MSStoreResolveParams): Promise<MSStoreResolveResult> {
    this.validateParams(params);

    const response = await get("/api/msstore/resolve", {
      type: params.type,
      query: params.query.trim(),
      market: this.market,
      language: this.language,
    });

    return response.data as MSStoreResolveResult;
  }
}

export const msStoreService = new MSStoreService();
