import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { EDAResult } from "@/lib/eda";

interface EdaState {
  edaResult: EDAResult | null;
  edaDescription: string;
  setEdaResult: (r: EDAResult | null) => void;
  setEdaDescription: (d: string) => void;
  clearEda: () => void;
}

export const useEdaStore = create<EdaState>()(
  persist(
    (set) => ({
      edaResult: null,
      edaDescription: "",
      setEdaResult: (r) => set({ edaResult: r }),
      setEdaDescription: (d) => set({ edaDescription: d }),
      clearEda: () => set({ edaResult: null, edaDescription: "" }),
    }),
    {
      name: "analyticsvisualai-eda-v1",
      storage: createJSONStorage(() => sessionStorage), // EDA is session-only
      partialize: (s) => ({
        edaResult: s.edaResult
          ? { ...s.edaResult, clean_rows: [] }  // don't persist full rows
          : null,
        edaDescription: s.edaDescription,
      }),
    }
  )
);
