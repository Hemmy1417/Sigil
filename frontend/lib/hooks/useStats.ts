"use client";

import { useEffect, useState } from "react";
import { getStats } from "../contracts/sigil";
import { CONTRACT_CONFIGURED } from "../config";
import type { Stats } from "../contracts/types";

export function useStats(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (!CONTRACT_CONFIGURED) return;
    getStats().then(setStats).catch(() => {});
  }, []);
  return stats;
}
