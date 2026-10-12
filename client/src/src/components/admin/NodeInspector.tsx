import { useState } from 'react';
import type { FormEvent } from 'react';
import type { NodeChanges } from '../../api/admin';
import { NODE_TYPE_LABELS } from '../../types/graph';
import type { GraphNode, NodeType } from '../../types/graph';

interface NodeInspectorProps {
  node: GraphNode;
  placeName: string | null; // when this point is the entrance of a place
  connectorIds: string[]; // the ids already used in the building, as suggestions
  isBusy: boolean;
  isMoving: boolean;
  onSave: (changes: NodeChanges) => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const EDITABLE_TYPES: NodeType[] = ['corridor', 'qr', 'stairs', 'elevator', 'entrance'];

// The details of one point. Give it key={node.id} from the parent,
// so the fields start over when another point is picked.
function NodeInspector({
  node,
  placeName,
  connectorIds,
  isBusy,
  isMoving,
  onSave,
  onMove,
  onDelete,
  onClose,
}: NodeInspectorProps) {
  const [type, setType] = useState<NodeType>(node.type);
  const [connectorId, setConnectorId] = useState(node.connectorId ?? '');
  const [label, setLabel] = useState(node.label);

  const isConnector = type === 'stairs' || type === 'elevator';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Only what changed. An empty text removes the field on the server.
    const changes: NodeChanges = {};
    if (type !== node.type) changes.type = type;

    // Only stairs and elevators keep a connector id
    const newConnector = isConnector ? connectorId.trim() : '';
    if (newConnector !== (node.connectorId ?? '')) changes.connectorId = newConnector;

    if (label.trim() !== node.label) changes.label = label.trim();

    onSave(changes);
  }

  return (
    <form className="admin-card" onSubmit={handleSubmit}>
      <div className="sheet-header">
        <h2 className="admin-card-title">{NODE_TYPE_LABELS[node.type]}</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </div>

      {placeName ? (
        <p className="admin-card-text">
          The entrance of <strong>{placeName}</strong>. Connect it to a walkway. You can move it to the door.
        </p>
      ) : (
        <>
          <label className="field-label" htmlFor="node-type">
            Type
          </label>
          <select
            id="node-type"
            className="field-input"
            value={type}
            onChange={(event) => setType(event.target.value as NodeType)}
          >
            {EDITABLE_TYPES.map((value) => (
              <option key={value} value={value}>
                {NODE_TYPE_LABELS[value]}
              </option>
            ))}
          </select>

          {isConnector && (
            <>
              <label className="field-label" htmlFor="node-connector">
                Connector id
              </label>
              <input
                id="node-connector"
                className="field-input"
                required
                maxLength={40}
                list="connector-ids"
                placeholder="elevator-main"
                value={connectorId}
                onChange={(event) => setConnectorId(event.target.value)}
              />
              <datalist id="connector-ids">
                {connectorIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
              <p className="field-hint">
                Give the same {type === 'elevator' ? 'elevator' : 'stairs'} the same id on every floor. That is how
                floors are connected.
              </p>
            </>
          )}

          <label className="field-label" htmlFor="node-label">
            Name {type === 'qr' ? '' : '(optional)'}
          </label>
          <input
            id="node-label"
            className="field-input"
            maxLength={60}
            required={type === 'qr'}
            placeholder={type === 'qr' ? 'North entrance' : ''}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          {type === 'qr' && (
            <p className="field-hint">Printed under the QR code, and shown as "You are here" after a scan.</p>
          )}
        </>
      )}

      <div className="form-actions">
        {!placeName && (
          <button type="submit" className="btn btn-primary" disabled={isBusy}>
            Save
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onMove} disabled={isBusy}>
          {isMoving ? 'Click the new spot...' : 'Move'}
        </button>
        {!placeName && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={isBusy}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

export default NodeInspector;
