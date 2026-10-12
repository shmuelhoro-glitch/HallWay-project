import type { NodeType } from '../../types/graph';

// What a click does in the walkways editor
export type EditorMode = 'draw' | 'select' | 'block' | 'delete';

export const EDITOR_MODES: { value: EditorMode; label: string; hint: string }[] = [
  {
    value: 'draw',
    label: 'ציור',
    hint: 'לחצו במפה כדי להוסיף נקודות. כל נקודה חדשה מתחברת לקודמת. לחיצה על נקודה קיימת מחברת אליה. כדי לעצור, לחצו שוב על הנקודה האחרונה או הקישו Esc.',
  },
  {
    value: 'select',
    label: 'עריכה',
    hint: 'לחצו על נקודה כדי לשנות את הסוג שלה (קוד QR, מדרגות, מעלית), את השם שלה, או כדי להזיז אותה.',
  },
  {
    value: 'block',
    label: 'חסימה',
    hint: 'לחצו על מעבר כדי לחסום אותו (למשל בזמן שיפוץ), ושוב כדי לפתוח אותו. המסלולים של המבקרים עוקפים מעברים חסומים.',
  },
  {
    value: 'delete',
    label: 'מחיקה',
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
