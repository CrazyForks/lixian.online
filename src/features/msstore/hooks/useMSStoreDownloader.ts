import { useCallback, useMemo, useState } from "react";
import { msStoreService } from "../api/MSStoreService";
import { MSStoreResolveResult } from "../types";

export function useMSStoreDownloader(initialValue?: string) {
  const [query, setQuery] = useState(initialValue ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MSStoreResolveResult | null>(null);

  const placeholder = useMemo(() => msStoreService.getPlaceholder(), []);
  const examples = useMemo(() => msStoreService.getExamples(), []);

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
        const parsed = await msStoreService.resolve({ query });
        setResult(parsed);
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  return {
    query,
    loading,
    result,
    placeholder,
    examples,
    onQueryChange,
    fillExample,
    handleSubmit,
  };
}
