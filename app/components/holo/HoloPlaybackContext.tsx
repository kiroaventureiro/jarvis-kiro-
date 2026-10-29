"use client";
import { createContext } from "react";
import type { Highlight } from "../../../lib/holo/reveal";
export const HoloPlaybackContext = createContext<{
  playing: boolean;
  instant: boolean;
  automatic?: boolean;
  elapsed?: number;
  bodyStart?: number;
  subtitleStart?: number;
  highlights?: Highlight[];
}>({ playing: true, instant: false });
