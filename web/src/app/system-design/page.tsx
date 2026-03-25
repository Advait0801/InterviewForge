"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

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

type Company = "none" | "amazon" | "google" | "meta";

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

function layoutNodes(raw: SystemDesignNode[]): Node[] {
  const layers: Map<number, SystemDesignNode[]> = new Map();
  for (const n of raw) {
    const layer = TYPE_LAYER[n.type] ?? 2;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(n);
  }

  const sorted = [...layers.entries()].sort((a, b) => a[0] - b[0]);
  const nodes: Node[] = [];
  const xGap = 240;
  const yGap = 140;

  sorted.forEach(([, group], layerIdx) => {
    const totalWidth = (group.length - 1) * xGap;
    const startX = -totalWidth / 2;
    group.forEach((n, colIdx) => {
      nodes.push({
        id: n.id,
        position: { x: startX + colIdx * xGap, y: layerIdx * yGap },
        data: { label: n.label },
        style: {
          background: nodeColor(n.type),
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 600,
          minWidth: 130,
          textAlign: "center" as const,
        },
      });
    });
  });

  return nodes;
}

function layoutEdges(raw: { source: string; target: string; label: string }[]): Edge[] {
  return raw.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 1.5 },
    labelStyle: { fontSize: 11, fontWeight: 500 },
  }));
}

/* ── page ── */

export default function SystemDesignPage() {
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [company, setCompany] = useState<Company>("none");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<SystemDesignAnalysis | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [feedbackTab, setFeedbackTab] = useState<"summary" | "rubric" | "risks" | "improvements">("summary");

  const handleAnalyze = async () => {
    if (!prompt.trim() || !explanation.trim()) {
      toast.error("Both prompt and explanation are required");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await api.analyzeSystemDesign(
        prompt,
        explanation,
        company === "none" ? undefined : company,
      );
      setResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
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
          toast.error(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not access microphone");
    }
  }, [recording]);

  const reset = () => {
    setResult(null);
    setPrompt("");
    setExplanation("");
    setFeedbackTab("summary");
  };

  const flowNodes = result ? layoutNodes(result.nodes) : [];
  const flowEdges = result ? layoutEdges(result.edges) : [];

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible">
          {!result ? (
            /* ── Input mode ── */
            <div className="space-y-8">
              <motion.div variants={fadeUp} custom={0}>
                <h1 className="mb-2 text-3xl font-semibold sm:text-4xl">System Design</h1>
                <p className="max-w-2xl text-text-secondary">
                  Describe your architecture for a system design prompt. Use text, voice, or both.
                  The AI will extract components, generate an architecture diagram, and score your design.
                </p>
              </motion.div>

              {/* Preset prompts */}
              <motion.div variants={fadeUp} custom={1}>
                <h2 className="mb-3 text-lg font-semibold">Choose a Prompt</h2>
                <div className="flex flex-wrap gap-2">
                  {PRESET_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrompt(p)}
                      className={`rounded-xl border px-4 py-2 text-sm transition ${
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
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Or type a custom system design prompt..."
                  rows={2}
                  className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary placeholder:text-text-secondary/50"
                />
              </motion.div>

              {/* Company selector */}
              <motion.div variants={fadeUp} custom={2}>
                <h2 className="mb-3 text-lg font-semibold">Company Context <span className="text-sm font-normal text-text-secondary">(optional)</span></h2>
                <div className="flex flex-wrap gap-2">
                  {(["none", "amazon", "google", "meta"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCompany(c)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                        company === c
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-text-secondary hover:border-primary/50"
                      }`}
                    >
                      {c === "none" ? "None" : c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Explanation input */}
              <motion.div variants={fadeUp} custom={3}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your Explanation</h2>
                  <div className="flex items-center gap-2">
                    {transcribing && <span className="text-xs text-text-secondary">Transcribing...</span>}
                    <Button
                      variant={recording ? "danger" : "ghost"}
                      onClick={toggleRecording}
                      className="text-sm"
                    >
                      {recording ? "Stop Recording" : "Record Voice"}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain your system design here. Describe components, data flow, trade-offs, and scaling strategy. You can also use the voice recorder above..."
                  rows={10}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-primary placeholder:text-text-secondary/50"
                />
              </motion.div>

              {/* Analyze */}
              <motion.div variants={fadeUp} custom={4}>
                <Button onClick={handleAnalyze} disabled={analyzing || !prompt.trim() || !explanation.trim()}>
                  {analyzing ? "Analyzing..." : "Analyze Design"}
                </Button>
              </motion.div>
            </div>
          ) : (
            /* ── Results mode ── */
            <motion.div variants={fadeUp} custom={0} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold sm:text-3xl">Analysis Results</h1>
                  <p className="mt-1 text-sm text-text-secondary">{prompt}</p>
                </div>
                <Button variant="ghost" onClick={reset}>Try Another</Button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Architecture diagram */}
                <Card className="p-0 overflow-hidden">
                  <div className="border-b border-border px-4 py-2.5">
                    <h3 className="text-sm font-semibold">Architecture Diagram</h3>
                  </div>
                  <div className="h-[480px]">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      fitView
                      fitViewOptions={{ padding: 0.3 }}
                      proOptions={{ hideAttribution: true }}
                      nodesDraggable
                      nodesConnectable={false}
                      colorMode="dark"
                    >
                      <Background gap={20} />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </div>
                </Card>

                {/* Right: AI feedback */}
                <Card className="flex flex-col p-0 overflow-hidden">
                  <div className="flex shrink-0 border-b border-border">
                    {(["summary", "rubric", "risks", "improvements"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
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
                  <div className="flex-1 overflow-y-auto p-4">
                    {feedbackTab === "summary" && (
                      <div className="space-y-3">
                        <p className="text-sm leading-relaxed">{result.summary}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {result.nodes.map((n) => (
                            <span
                              key={n.id}
                              className="rounded-lg px-2.5 py-1 text-xs font-medium"
                              style={{ background: nodeColor(n.type) + "20", color: nodeColor(n.type) }}
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
                            <div className="mb-2 h-2 rounded-full bg-border">
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
                </Card>
              </div>
            </motion.div>
          )}
        </motion.div>
      </PageShell>
    </Protected>
  );
}
