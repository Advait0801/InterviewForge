export type WorkspacePane = "problem" | "editor";

export function WorkspacePaneSwitcher({
  value,
  onChange,
}: {
  value: WorkspacePane;
  onChange: (pane: WorkspacePane) => void;
}) {
  return (
    <div className="grid grid-cols-2 border-b border-border bg-surface p-1 md:hidden" aria-label="Workspace pane">
      {(["problem", "editor"] as const).map((pane) => (
        <button
          key={pane}
          type="button"
          aria-pressed={value === pane}
          onClick={() => onChange(pane)}
          className={`min-h-10 rounded-md px-3 text-sm font-semibold transition-colors ${
            value === pane ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          {pane === "problem" ? "Problem" : "Editor"}
        </button>
      ))}
    </div>
  );
}
