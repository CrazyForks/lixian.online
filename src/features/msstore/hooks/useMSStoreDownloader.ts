import { useCallback, useMemo, useState } from "react";
import { msStoreService } from "../api/MSStoreService";
import {
  MSStoreRequestType,
  MSStoreResolveResult,
} from "../types";

export function useMSStoreDownloader() {
  const [requestType, setRequestType] = useState<MSStoreRequestType>("url");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MSStoreResolveResult | null>(null);

  const typeOptions = useMemo(() => msStoreService.getTypeOptions(), []);
  const placeholder = useMemo(
    () => msStoreService.getPlaceholder(requestType),
    [requestType],
  );
  const examples = useMemo(
    () => msStoreService.getExamples(requestType),
    [requestType],
  );

  const onRequestTypeChange = useCallback((value: string) => {
    setRequestType(value as MSStoreRequestType);
    setResult(null);
  }, []);

  const onQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setResult(null);
  }, []);

  const fillExample = useCallback((value: string) => {
    setQuery(value);
    setResult(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
        const parsed = await msStoreService.resolve({
          type: requestType,
          query,
        });
        setResult(parsed);
      } finally {
        setLoading(false);
      }
    },
    [query, requestType],
  );

  return {
    requestType,
    query,
    loading,
    result,
    typeOptions,
    placeholder,
    examples,
    onRequestTypeChange,
    onQueryChange,
    fillExample,
    handleSubmit,
  };
}
