"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { useTheme } from "@/components/ui/theme-provider";
import { toast } from "sonner";
import {
  api,
  type SystemDesignAnalysis,
  type SystemDesignNode,
} from "@/lib/api";

/* ── helpers ── */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const PRESET_PROMPTS = [
  "Design a URL shortener like bit.ly",
  "Design a real-time chat system like Slack",
  "Design a news feed system like Twitter",
  "Design a video streaming platform like YouTube",
  "Design a ride-sharing service like Uber",
  "Design a distributed cache like Redis",
];

const RUBRIC_LABELS: Record<string, string> = {
  requirements: "Requirements",
  scalability: "Scalability",
  reliability: "Reliability",
  data_modeling: "Data Modeling",
  communication: "Communication",
};

type Company = "none" | "amazon" | "google" | "meta" | "apple";

/* ── node layout: group by type into layers ── */

const TYPE_LAYER: Record<string, number> = {
  client: 0,
  gateway: 1,
  load_balancer: 1,
  service: 2,
  cache: 3,
  queue: 3,
  db: 4,
  database: 4,
  storage: 4,
};

function nodeColor(type: string): string {
  switch (type) {
    case "client": return "#3b82f6";
    case "gateway": case "load_balancer": return "#8b5cf6";
    case "service": return "#06b6d4";
    case "cache": return "#f59e0b";
    case "queue": return "#ec4899";
    case "db": case "database": case "storage": return "#10b981";
    default: return "#6b7280";
  }
}

function layoutNodes(raw: SystemDesignNode[], wide: boolean): Node[] {
  const layers: Map<number, SystemDesignNode[]> = new Map();
  for (const n of raw) {
    const layer = TYPE_LAYER[n.type] ?? 2;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(n);
  }

  const sorted = [...layers.entries()].sort((a, b) => a[0] - b[0]);
  const nodes: Node[] = [];
  const xGap = 220;
  const yGap = 140;

  sorted.forEach(([, group], layerIdx) => {
    const totalWidth = (group.length - 1) * xGap;
    const startX = -totalWidth / 2;
    group.forEach((n, colIdx) => {
      nodes.push({
        id: n.id,
        position: wide
          ? { x: layerIdx * xGap, y: (colIdx - (group.length - 1) / 2) * yGap }
          : { x: startX + colIdx * xGap, y: layerIdx * yGap },
        sourcePosition: wide ? Position.Right : Position.Bottom,
        targetPosition: wide ? Position.Left : Position.Top,
        data: { label: n.label },
        style: {
          background: nodeColor(n.type),
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "10px 18px",
          fontSize: 16,
          fontWeight: 600,
          minWidth: 150,
          textAlign: "center" as const,
        },
      });
    });
  });

  return nodes;
}

function subscribeToWideLayout(onChange: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getWideLayout() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function layoutEdges(raw: { source: string; target: string; label: string }[], reduceMotion: boolean): Edge[] {
  return raw.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: !reduceMotion,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 1.5 },
    labelStyle: { fontSize: 11, fontWeight: 500 },
  }));
}

/* ── page ── */

export default function SystemDesignPage() {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion() ?? false;
  const wideLayout = useSyncExternalStore(subscribeToWideLayout, getWideLayout, () => false);
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [company, setCompany] = useState<Company>("none");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<SystemDesignAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => () => {
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const [feedbackTab, setFeedbackTab] = useState<"summary" | "rubric" | "risks" | "improvements">("summary");

  const handleAnalyze = async () => {
    if (!prompt.trim() || !explanation.trim()) {
      toast.error("Both prompt and explanation are required");
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await api.analyzeSystemDesign(
        prompt,
        explanation,
        company === "none" ? undefined : company,
      );
      setResult(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRecording = useCallback(async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      setVoiceError(null);
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Microphone recording is unavailable in this browser. You can still type your explanation.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const buffer = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const res = await api.transcribeSpeech(base64);
          setExplanation((prev) => (prev ? prev + "\n\n" : "") + res.transcript);
          toast.success("Transcription appended");
        } catch (err) {
          const message = err instanceof Error ? err.message : "Transcription failed";
          setVoiceError(message);
          toast.error(message);
        } finally {
          setTranscribing(false);
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not access microphone";
      setVoiceError(message);
      toast.error(message);
    }
  }, [recording]);

  const reset = () => {
    setResult(null);
    setPrompt("");
    setExplanation("");
    setFeedbackTab("summary");
    setAnalysisError(null);
  };

  const flowNodes = result ? layoutNodes(result.nodes, wideLayout) : [];
  const flowEdges = result ? layoutEdges(result.edges, reduceMotion) : [];

  return (
    <Protected>
      <PageShell>
        <div>
          {!result ? (
            /* ── Input mode ── */
            <div className="space-y-8">
              <div>
                <h1 className="mb-2 text-3xl font-semibold sm:text-4xl">System design review</h1>
                <p className="max-w-2xl text-text-secondary">
                  Describe your architecture for a system design prompt. Use text, voice, or both.
                  The AI will extract components, generate an architecture diagram, and score your design.
                </p>
              </div>

              {/* Preset prompts */}
              <div>
                <h2 className="mb-3 text-lg font-semibold">Design prompt</h2>
                <div className="flex flex-wrap gap-2">
                  {PRESET_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={prompt === p}
                      onClick={() => setPrompt(p)}
                      className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                        prompt === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-text-secondary hover:border-primary/40"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-label="Design prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Or type a custom system design prompt..."
                  rows={2}
                  className="mt-3 w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary placeholder:text-text-secondary/50"
                />
              </div>

              {/* Company selector */}
              <div>
                <h2 className="mb-3 text-lg font-semibold">Company Context <span className="text-sm font-normal text-text-secondary">(optional)</span></h2>
                <div className="flex flex-wrap gap-2">
                  {(["none", "amazon", "google", "meta", "apple"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={company === c}
                      onClick={() => setCompany(c)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        company === c
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-text-secondary hover:border-primary/50"
                      }`}
                    >
                      {c === "none" ? "None" : c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Explanation input */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label htmlFor="design-explanation" className="text-lg font-semibold">Your explanation</label>
                  <div className="flex items-center gap-2">
                    {transcribing && <span className="text-xs text-text-secondary">Transcribing...</span>}
                    <Button
                      variant={recording ? "danger" : "ghost"}
                      onClick={toggleRecording}
                      disabled={analyzing || transcribing}
                      className="text-sm"
                    >
                      {recording ? "Stop Recording" : "Record Voice"}
                    </Button>
                  </div>
                </div>
                <textarea
                  id="design-explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain your system design here. Describe components, data flow, trade-offs, and scaling strategy. You can also use the voice recorder above..."
                  rows={10}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-primary placeholder:text-text-secondary/50"
                />
                {voiceError && <p role="alert" className="mt-2 text-sm text-error">{voiceError}</p>}
              </div>

              {/* Analyze */}
              <div>
                <Button onClick={handleAnalyze} loading={analyzing} loadingLabel="Analyzing design" disabled={!prompt.trim() || !explanation.trim() || recording || transcribing}>
                  Analyze design
                </Button>
                {analysisError && <StatePanel tone="error" title="Analysis unavailable" description={analysisError} className="mt-4" action={<Button variant="ghost" onClick={handleAnalyze}>Retry analysis</Button>} />}
              </div>
            </div>
          ) : (
            /* ── Results mode ── */
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold sm:text-3xl">Design feedback</h1>
                  <p className="mt-1 text-sm text-text-secondary">{prompt}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setResult(null)}>Edit design</Button>
                  <Button variant="ghost" onClick={reset}>Try another</Button>
                </div>
              </div>

              <div className="space-y-8">
                <section aria-labelledby="diagram-heading" className="border-y border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <h2 id="diagram-heading" className="text-lg font-semibold">Architecture diagram</h2>
                    <p className="text-sm text-text-secondary">{result.nodes.length} components · {result.edges.length} connections</p>
                  </div>
                  {result.nodes.length > 0 ? <div className="h-[min(62vh,600px)] min-h-[340px] w-full bg-surface">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      fitView
                      fitViewOptions={{ padding: 0.3 }}
                      proOptions={{ hideAttribution: true }}
                      nodesDraggable
                      nodesConnectable={false}
                      colorMode={theme}
                      aria-label="Architecture diagram"
                    >
                      <Background gap={20} />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </div> : <StatePanel title="No diagram components" description="The analysis returned feedback without an architecture diagram." />}
                  {result.nodes.length > 0 && <details className="py-3 text-sm">
                    <summary className="cursor-pointer font-semibold">Components and connections</summary>
                    <ul className="mt-3 list-inside list-disc space-y-1 text-text-secondary">
                      {result.nodes.map((node) => <li key={node.id}>{node.label} ({node.type})</li>)}
                      {result.edges.map((edge, index) => <li key={`${edge.source}-${edge.target}-${index}`}>{result.nodes.find((node) => node.id === edge.source)?.label ?? edge.source} to {result.nodes.find((node) => node.id === edge.target)?.label ?? edge.target}{edge.label ? `: ${edge.label}` : ""}</li>)}
                    </ul>
                  </details>}
                </section>

                <section aria-label="Design assessment" className="border-y border-border">
                  <div className="flex flex-wrap border-b border-border" role="tablist" aria-label="Feedback sections">
                    {(["summary", "rubric", "risks", "improvements"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={feedbackTab === tab}
                        onClick={() => setFeedbackTab(tab)}
                        className={`px-4 py-2.5 text-xs font-medium capitalize transition ${
                          feedbackTab === tab
                            ? "border-b-2 border-primary text-primary"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div role="tabpanel" className="max-w-3xl py-5">
                    {feedbackTab === "summary" && (
                      <div className="space-y-3">
                        <p className="text-sm leading-relaxed">{result.summary}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {result.nodes.map((n) => (
                            <span
                              key={n.id}
                              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium"
                            >
                              {n.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {feedbackTab === "rubric" && (
                      <div className="space-y-4">
                        {Object.entries(result.rubric).map(([key, section]) => (
                          <div key={key}>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-sm font-semibold">{RUBRIC_LABELS[key] ?? key}</span>
                              <span className="text-sm font-bold text-primary">{section.score}/10</span>
                            </div>
                            <div className="mb-2 h-2 rounded-full bg-border" role="progressbar" aria-label={`${RUBRIC_LABELS[key] ?? key} score`} aria-valuemin={0} aria-valuemax={10} aria-valuenow={section.score}>
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                                style={{ width: `${(section.score / 10) * 100}%` }}
                              />
                            </div>
                            <p className="text-xs text-text-secondary">{section.notes}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {feedbackTab === "risks" && (
                      <ul className="space-y-2">
                        {result.risks.length === 0 && (
                          <p className="text-sm text-text-secondary">No risks identified.</p>
                        )}
                        {result.risks.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 text-error">&#9679;</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {feedbackTab === "improvements" && (
                      <ul className="space-y-2">
                        {result.improvements.length === 0 && (
                          <p className="text-sm text-text-secondary">No improvements suggested.</p>
                        )}
                        {result.improvements.map((imp, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 text-accent">&#9679;</span>
                            <span>{imp}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </PageShell>
    </Protected>
  );
}
