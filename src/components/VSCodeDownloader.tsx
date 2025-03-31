"use client";

import { useState } from "react";
import {
  Box,
  Input,
  Button,
  VStack,
  Text,
  useToast,
  Link,
  Select,
} from "@chakra-ui/react";
import axios from "axios";
import { get } from "lodash";

// https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery
function getVersionList(
  publisher: string,
  extension: string
): Promise<string[]> {
  const url = `https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`;
  const payload = {
    filters: [
      {
        criteria: [
          {
            filterType: 7,
            value: `${publisher}.${extension}`,
          },
        ],
        pageNumber: 1,
        pageSize: 100,
        sortBy: 0,
        sortOrder: 0,
      },
    ],
    flags: 402,
  };
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json;api-version=3.0-preview.1",
  };

  // request with headers
  return axios
    .post(url, payload, { headers })
    .then((response) => {
      console.log(response.data);
      const versions = response.data.results[0].extensions[0].versions.map(
        (each: any) => {
          return each.version;
        }
      );
      return versions;
    })
    .catch((error) => {
      console.error("Error fetching version list:", error);
      throw error;
    });
}

export default function VSCodeDownloader() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [publisher, setPublisher] = useState("");
  const [extension, setExtension] = useState("");
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDownloadUrl("");
    setVersions([]);
    setSelectedVersion("");

    try {
      // 从 URL 中提取发布者和扩展名
      const urlObj = new URL(url);
      const itemName = urlObj.searchParams.get("itemName");
      if (!itemName) {
        throw new Error("无效的插件 URL");
      }

      const [pub, ext] = itemName.split(".");
      setPublisher(pub);
      setExtension(ext);

      // 获取版本列表
      const versionList = await getVersionList(pub, ext);
      if (versionList.length === 0) {
        throw new Error("未找到插件版本");
      }

      setVersions(versionList);
      setSelectedVersion(versionList[0]);

      toast({
        title: "解析成功",
        description: "已找到可用版本",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "解析失败",
        description:
          error instanceof Error ? error.message : "请检查 URL 是否正确",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
    const downloadUrl = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${publisher}/vsextensions/${extension}/${version}/vspackage`;
    setDownloadUrl(downloadUrl);
  };

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <VStack spacing={4}>
        <Input
          placeholder="请输入 VSCode 插件 URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          size="lg"
        />
        <Button
          type="submit"
          colorScheme="blue"
          isLoading={loading}
          loadingText="解析中..."
        >
          解析下载链接
        </Button>

        {versions.length > 0 && (
          <Select
            value={selectedVersion}
            onChange={(e) => handleVersionChange(e.target.value)}
            size="lg"
          >
            {versions.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </Select>
        )}

        {downloadUrl && (
          <Box w="100%" p={4} borderWidth={1} borderRadius="md">
            <Text mb={2}>下载链接：</Text>
            <Link href={downloadUrl} color="blue.500" isExternal>
              {downloadUrl}
            </Link>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
