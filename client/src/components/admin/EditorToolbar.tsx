import { NODE_TYPE_LABELS } from '../../types/graph';
import type { NodeType } from '../../types/graph';
import { EDITOR_LAYERS, EDITOR_MODES, NODE_COLORS } from './editorModes';
import type { EditorLayers, EditorMode } from './editorModes';

interface EditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  undoLabel: string | null; // what "Undo" would undo ("הזזת נקודה"), null when there is nothing
  redoLabel: string | null;
  isBusy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  layers: EditorLayers;
  onLayersChange: (layers: EditorLayers) => void;
  isSnapOn: boolean;
  onSnapChange: (isSnapOn: boolean) => void;
}

const LEGEND_TYPES: NodeType[] = ['corridor', 'entrance', 'qr', 'stairs', 'elevator'];

// The four modes of the editor, what the current one does, and what the colors mean
function EditorToolbar({
  mode,
  onModeChange,
  undoLabel,
  redoLabel,
  isBusy,
  onUndo,
  onRedo,
  layers,
  onLayersChange,
  isSnapOn,
  onSnapChange,
}: EditorToolbarProps) {
  const currentMode = EDITOR_MODES.find((item) => item.value === mode);

  return (
    <section className="admin-card">
      <h2 className="admin-card-title">מעברים</h2>
      <p className="admin-card-text">הדרכים שבהן המבקרים הולכים. המסלול מחושב לאורכן.</p>

      <div className="segmented editor-modes" role="group" aria-label="מצב העורך">
        {EDITOR_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={mode === item.value}
            title={`${item.label} (מקש ${item.shortcut})`}
            onClick={() => onModeChange(item.value)}
          >
            {item.label}
            <kbd className="editor-key">{item.shortcut}</kbd>
          </button>
        ))}
      </div>

      {currentMode && <p className="field-hint">{currentMode.hint}</p>}

      {/* Every change is saved right away. Undo sends the opposite change to the server. */}
      <div className="editor-history">
        <button
          type="button"
          className="btn btn-small"
          disabled={isBusy || undoLabel === null}
          title={undoLabel ? `ביטול: ${undoLabel} (Ctrl+Z)` : 'אין מה לבטל'}
          onClick={onUndo}
        >
          ביטול
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={isBusy || redoLabel === null}
          title={redoLabel ? `ביצוע מחדש: ${redoLabel} (Ctrl+Y)` : 'אין מה לבצע מחדש'}
          onClick={onRedo}
        >
          ביצוע מחדש
        </button>
        {undoLabel && <span className="editor-history-last">אחרון: {undoLabel}</span>}
      </div>

      <div className="editor-options">
        <span className="editor-options-title">מה מוצג במפה</span>
        {EDITOR_LAYERS.map((layer) => (
          <label key={layer.key} className="editor-option">
            <input
              type="checkbox"
              checked={layers[layer.key]}
              onChange={(event) => onLayersChange({ ...layers, [layer.key]: event.target.checked })}
            />
            {layer.label}
          </label>
        ))}
      </div>

      <div className="editor-options">
        <label className="editor-option" title="נקודה שכמעט מיושרת עם שכנה מתיישרת איתה, ולחיצה ליד נקודה מתחברת אליה">
          <input type="checkbox" checked={isSnapOn} onChange={(event) => onSnapChange(event.target.checked)} />
          הצמדה לנקודות ולקווים ישרים
        </label>
      </div>

      <div className="editor-legend">
        {LEGEND_TYPES.map((type) => (
          <span key={type} className="editor-legend-item">
            <span className="editor-legend-dot" style={{ background: NODE_COLORS[type] }} />
            {NODE_TYPE_LABELS[type]}
          </span>
        ))}
        <span className="editor-legend-item">
          <span className="editor-legend-line is-blocked" />
          מעבר חסום
        </span>
      </div>
    </section>
  );
}

export default EditorToolbar;
