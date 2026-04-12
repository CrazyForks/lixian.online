"use client";

import { useState, useCallback, type ComponentType } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent } from "@/shared/ui/card";
import { Github } from "lucide-react";
import { LoadingSpinner } from "@/shared/ui/loading-spinner";
import { site } from "@/shared/lib/site";
import {
  featureTabs,
  type DownloaderProps,
  type TabLoader,
} from "@/features/registry";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown";
const COMMIT_HASH = process.env.NEXT_PUBLIC_COMMIT_HASH ?? "unknown";

const DynamicFallback = () => (
  <div className="flex items-center justify-center py-12">
    <LoadingSpinner />
  </div>
);

const tabLoaders: Record<string, TabLoader> = {
  vscode: () => import("@/features/vscode/components/VSCodeDownloader"),
  chrome: () => import("@/features/chrome/components/ChromeDownloader"),
  docker: () => import("@/features/docker/components/DockerDownloader"),
  msstore: () => import("@/features/msstore/components/MSStoreDownloader"),
};

const tabComponents: Record<string, ComponentType<DownloaderProps>> =
  Object.fromEntries(
    featureTabs.map((tab) => [
      tab.id,
      dynamic(tabLoaders[tab.id], { ssr: false, loading: DynamicFallback }),
    ]),
  );

function getInitialQuery() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

interface Props {
  tab: string;
}

export default function TabPage({ tab }: Props) {
  const [initialQuery] = useState(getInitialQuery);
  const [activeTab, setActiveTab] = useState(tab);

  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    window.history.replaceState(null, "", `/${newTab}`);
  }, []);

  const handleQueryChange = useCallback((q: string) => {
    const url = new URL(window.location.href);
    if (q) {
      url.searchParams.set("q", q);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-12 md:py-24">
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-12 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 md:mb-3 tracking-tight flex items-baseline justify-center gap-0.5 sm:gap-1">
            <span>Lixian</span>
            <Image
              src="/favicon.ico"
              alt=""
              width={16}
              height={16}
              className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4"
            />
            <span>Online</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            {site.description}
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-apple-lg border-0 bg-card/80 backdrop-blur-xl rounded-apple-lg overflow-visible animate-slide-up">
          <CardContent className="p-0">
            <div className="border-b border-border/40 px-3 sm:px-6 pt-4 sm:pt-6 pb-0">
              <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="w-full"
              >
                <TabsList
                  className="grid w-full bg-secondary/60 backdrop-blur-sm rounded-apple p-1 border border-border/40 h-10 sm:h-12"
                  style={{
                    gridTemplateColumns: `repeat(${featureTabs.length}, minmax(0, 1fr))`,
                  }}
                >
                  {featureTabs.map((ft) => (
                    <TabsTrigger
                      key={ft.id}
                      value={ft.id}
                      data-testid={`tab-${ft.id}`}
                      className="rounded-apple-sm font-medium text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-4 data-[state=active]:bg-background data-[state=active]:shadow-apple-button data-[state=active]:text-foreground transition-all duration-200 gap-1.5 sm:gap-2"
                    >
                      <ft.icon className="h-4 w-4 flex-shrink-0" />
                      {ft.shortLabel ? (
                        <>
                          <span className="hidden sm:inline">{ft.label}</span>
                          <span className="sm:hidden">{ft.shortLabel}</span>
                        </>
                      ) : (
                        ft.label
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Tab Content */}
            <div className="p-5 sm:p-8 md:p-10">
              {featureTabs.map((ft) => {
                const Component = tabComponents[ft.id];
                return (
                  <div
                    key={ft.id}
                    className={activeTab !== ft.id ? "hidden" : undefined}
                  >
                    <Component
                      defaultValue={
                        tab === ft.id ? initialQuery : undefined
                      }
                      onQueryChange={handleQueryChange}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center mt-8 md:mt-12 space-y-2 animate-fade-in">
          <p
            className="text-xs text-muted-foreground/70"
            title={`构建时间: ${BUILD_TIME} | Commit: ${COMMIT_HASH}`}
          >
            版本 v{APP_VERSION}
          </p>
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}
