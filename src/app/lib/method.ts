import { useMemo } from "react";
import { DEFAULT_LAST_LAYER, type AnalyzeOptions, type LastLayerMethod } from "@/cube";
import type { LearnSettings } from "@/shared/learn";
import { currentLearnSettings, useLearnSettings } from "./learnStore";

/** Cross, F2L, OLL, PLL until he picks otherwise in settings. */
export const DEFAULT_METHOD: LastLayerMethod = DEFAULT_LAST_LAYER;

/** What the analysis needs to name the last layer his way: his method and the algs he picked. */
export function analysisOptions(settings: LearnSettings = currentLearnSettings()): AnalyzeOptions {
  return { method: settings.lastLayer ?? DEFAULT_METHOD, algs: settings.algs };
}

export function useAnalysisOptions(): AnalyzeOptions {
  const settings = useLearnSettings();
  return useMemo(() => analysisOptions(settings), [settings]);
}
