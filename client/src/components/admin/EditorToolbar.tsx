import { NODE_TYPE_LABELS } from '../../types/graph';
import type { NodeType } from '../../types/graph';
import { EDITOR_MODES, NODE_COLORS } from './editorModes';
import type { EditorMode } from './editorModes';

interface EditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

const LEGEND_TYPES: NodeType[] = ['corridor', 'entrance', 'qr', 'stairs', 'elevator'];

// The four modes of the editor, what the current one does, and what the colors mean
function EditorToolbar({ mode, onModeChange }: EditorToolbarProps) {
  const currentMode = EDITOR_MODES.find((item) => item.value === mode);

  return (
    <section className="admin-card">
      <h2 className="admin-card-title">Walkways</h2>
      <p className="admin-card-text">The paths visitors walk on. The route is calculated on them.</p>

      <div className="segmented editor-modes" role="group" aria-label="Editor mode">
        {EDITOR_MODES.map((item) => (
          <button key={item.value} type="button" aria-pressed={mode === item.value} onClick={() => onModeChange(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      {currentMode && <p className="field-hint">{currentMode.hint}</p>}

      <div className="editor-legend">
        {LEGEND_TYPES.map((type) => (
          <span key={type} className="editor-legend-item">
            <span className="editor-legend-dot" style={{ background: NODE_COLORS[type] }} />
            {NODE_TYPE_LABELS[type]}
          </span>
        ))}
        <span className="editor-legend-item">
          <span className="editor-legend-line is-blocked" />
          Blocked
        </span>
      </div>
    </section>
  );
}

export default EditorToolbar;
