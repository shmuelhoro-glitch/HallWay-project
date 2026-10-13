import type { NodeType } from '../../types/graph';

// What a click does in the walkways editor
export type EditorMode = 'draw' | 'select' | 'block' | 'delete';

interface EditorModeInfo {
  value: EditorMode;
  label: string;
  shortcut: string; // the letter on the key, shown to the user
  keyCode: string; // the key itself (event.code), so it works with a Hebrew keyboard too
  mapHint: string; // one short line on top of the map
  hint: string; // the full explanation, in the side panel
}

export const EDITOR_MODES: EditorModeInfo[] = [
  {
    value: 'draw',
    label: 'ציור',
    shortcut: 'D',
    keyCode: 'KeyD',
    mapHint: 'לחצו במפה כדי להתחיל מעבר, או על נקודה קיימת כדי להמשיך ממנה.',
    hint: 'לחצו במפה כדי להוסיף נקודות. כל נקודה חדשה מתחברת לקודמת. לחיצה על נקודה קיימת מחברת אליה. כדי לעצור, לחצו שוב על הנקודה האחרונה או הקישו Esc.',
  },
  {
    value: 'select',
    label: 'עריכה',
    shortcut: 'V',
    keyCode: 'KeyV',
    mapHint: 'גררו נקודה כדי להזיז אותה, או לחצו עליה כדי לערוך.',
    hint: 'גררו נקודה כדי להזיז אותה. לחצו על נקודה כדי לשנות את הסוג שלה (קוד QR, מדרגות, מעלית) או את השם שלה.',
  },
  {
    value: 'block',
    label: 'חסימה',
    shortcut: 'B',
    keyCode: 'KeyB',
    mapHint: 'לחצו על מעבר כדי לחסום אותו, ושוב כדי לפתוח.',
    hint: 'לחצו על מעבר כדי לחסום אותו (למשל בזמן שיפוץ), ושוב כדי לפתוח אותו. המסלולים של המבקרים עוקפים מעברים חסומים.',
  },
  {
    value: 'delete',
    label: 'מחיקה',
    shortcut: 'X',
    keyCode: 'KeyX',
    mapHint: 'לחצו על נקודה או על מעבר כדי למחוק.',
    hint: 'לחצו על נקודה או על מעבר כדי למחוק אותם. כניסה של מקום נמחקת יחד עם המקום, בלשונית "מקומות".',
  },
];

// The color of each point type, on the map and in the legend
export const NODE_COLORS: Record<NodeType, string> = {
  corridor: '#3d4550',
  entrance: '#1f6b4a',
  qr: '#1d4ed8',
  stairs: '#b45309',
  elevator: '#7c3aed',
};
