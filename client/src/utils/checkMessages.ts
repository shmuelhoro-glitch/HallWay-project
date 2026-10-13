import type { CheckProblem } from '../api/admin';

// The Hebrew sentence for each problem the server finds in a building (services/dataCheck.service.js).

// ' "Sea Fashion"' when the thing has a name, '' when it has none
function quoted(problem: CheckProblem): string {
  return problem.name ? ` "${problem.name}"` : '';
}

// 'המקום "Sea Fashion"' / 'הנקודה "North entrance"' / 'נקודה ללא שם'
function subject(problem: CheckProblem): string {
  if (problem.kind === 'place') return `המקום${quoted(problem)}`;
  return problem.name ? `הנקודה${quoted(problem)}` : 'נקודה ללא שם';
}

const MESSAGES: Record<string, (problem: CheckProblem) => string> = {
  // Places
  PLACE_WITHOUT_ENTRANCE: (p) => `למקום${quoted(p)} אין נקודת כניסה, ולכן אין אליו מסלול.`,
  PLACE_ENTRANCE_MISSING: (p) => `נקודת הכניסה של המקום${quoted(p)} נמחקה, ולכן אין אליו מסלול.`,
  PLACE_NOT_CONNECTED: (p) => `הכניסה של המקום${quoted(p)} לא מחוברת לאף מעבר, ולכן אין אליו מסלול.`,
  PLACE_UNREACHABLE: (p) => `המקום${quoted(p)} לא מחובר לשאר המבנה, ולכן מבקרים לא יכולים להגיע אליו.`,
  PLACE_BLOCKED: (p) => `מעבר חסום מנתק את המקום${quoted(p)} משאר המבנה.`,
  PLACE_ENTRANCE_ON_OTHER_FLOOR: (p) => `הכניסה של המקום${quoted(p)} נמצאת בקומה אחרת מהמקום עצמו.`,
  PLACE_ENTRANCE_WRONG_TYPE: (p) => `הכניסה של המקום${quoted(p)} אינה נקודה מסוג "כניסה".`,
  PLACE_ENTRANCE_SHARED: (p) => `המקום${quoted(p)} חולק נקודת כניסה עם מקום אחר.`,

  // Points
  BAD_COORDINATES: (p) => `אין מיקום תקין במפה עבור ${subject(p)}.`,
  FLOOR_WITHOUT_PLAN: (p) => `אין תוכנית לקומה של ${subject(p)}.`,
  OUTSIDE_THE_PLAN: (p) => `המיקום של ${subject(p)} נמצא מחוץ לתוכנית הקומה.`,
  POINT_NOT_CONNECTED: (p) => `${subject(p)} לא מחוברת לאף מעבר.`,
  ENTRANCE_WITHOUT_PLACE: (p) => `נקודת הכניסה${quoted(p)} לא שייכת לאף מקום.`,
  QR_UNREACHABLE: (p) => `נקודת ה-QR${quoted(p)} לא מחוברת לשאר המבנה.`,

  // Stairs and elevators
  CONNECTOR_ID_MISSING: (p) => `למעלית או למדרגות${quoted(p)} חסר מזהה, ולכן הן לא מחברות קומות.`,
  CONNECTOR_ID_ON_OTHER_TYPE: () => 'נקודה רגילה נושאת מזהה של מעלית או מדרגות, ומסלולים עוברים דרכה בין קומות.',
  CONNECTOR_ON_ONE_FLOOR: (p) => `המזהה${quoted(p)} מוגדר בקומה אחת בלבד, ולכן לא מוביל לשום מקום.`,
  CONNECTOR_TWICE_ON_A_FLOOR: (p) => `המזהה${quoted(p)} מופיע יותר מפעם אחת באותה קומה.`,
  FLOOR_NOT_CONNECTED: () => 'הקומה לא מחוברת לשאר הקומות. בדקו את המדרגות והמעליות שלה.',

  // Walkways
  WALKWAY_BETWEEN_FLOORS: () => 'מעבר מחבר בין שתי קומות בלי מדרגות או מעלית.',
  WALKWAY_TO_MISSING_POINT: () => 'מעבר מוביל לנקודה שנמחקה.',
  WALKWAY_TO_ITSELF: () => 'מעבר מחבר נקודה לעצמה.',
  WALKWAY_TWICE: () => 'אותן שתי נקודות מחוברות פעמיים.',
  WALKWAY_IDS_NOT_TEXT: () => 'מעבר שמור בפורמט שגוי, ולכן הוא לא נטען.',

  // The building
  FLOOR_PLANS_MISSING: () => 'לא לכל הקומות הועלתה תוכנית.',
};

export function getCheckMessage(problem: CheckProblem): string {
  const write = MESSAGES[problem.code];
  return write ? write(problem) : 'נמצאה בעיה בנתוני המבנה.';
}

// Where the admin fixes this problem: the tab, the floor, and the point or place itself
export function getCheckLink(problem: CheckProblem): string {
  const floor = problem.floor === null ? '' : `floor=${problem.floor}`;

  if (problem.kind === 'place') return `../places?${floor}&place=${problem.id}`;
  if (problem.kind === 'node') return `../graph?${floor}&node=${problem.id}`;
  if (problem.kind === 'building') return '../floors';
  return `../graph?${floor}`;
}
