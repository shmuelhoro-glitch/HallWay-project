import { ApiError } from '../api/client';

// The server answers every error with a code and an English message (the English is for its log).
// The user sees Hebrew: each code has its message here. A code that is not here gets the general
// message of the screen, never the technical text of the server.
const MESSAGES: Record<string, string> = {
  // Who may do what
  NO_TOKEN: 'צריך להתחבר כדי לבצע את הפעולה הזאת.',
  INVALID_TOKEN: 'פג תוקף ההתחברות. התחברו מחדש.',
  FORBIDDEN: 'אין לכם הרשאה לבצע את הפעולה הזאת.',
  INVALID_CREDENTIALS: 'האימייל או הסיסמה שגויים.',
  EMAIL_TAKEN: 'האימייל הזה כבר רשום.',
  USERNAME_TAKEN: 'שם המשתמש הזה תפוס.',

  // Something that is not there (often: deleted in another tab)
  BUILDING_NOT_FOUND: 'המבנה לא נמצא.',
  FLOOR_NOT_FOUND: 'הקומה לא נמצאה.',
  PLACE_NOT_FOUND: 'המקום לא נמצא. ייתכן שהוא נמחק.',
  NODE_NOT_FOUND: 'הנקודה לא נמצאה. ייתכן שהיא נמחקה.',
  EDGE_NOT_FOUND: 'המעבר לא נמצא. ייתכן שהוא נמחק.',

  // A new building
  ADDRESS_NOT_FOUND: 'לא מצאנו את הכתובת במפה. בדקו את הרחוב ואת העיר.',
  GEOCODING_UNAVAILABLE: 'שירות איתור הכתובות לא זמין כרגע. נסו שוב בעוד רגע.',

  // Floors and places
  INVALID_SVG: 'קובץ ה-SVG לא תקין. הוא צריך להכיל viewBox.',
  TOO_MANY_LANDMARKS: 'בכל קומה יכולות להיות עד 5 נקודות ציון.',

  // The walkways editor
  CONNECTOR_REQUIRED: 'למדרגות ולמעלית צריך מזהה, זהה בכל הקומות.',
  DIFFERENT_FLOORS: 'שתי הנקודות צריכות להיות באותה קומה.',
  SAME_NODE: 'מעבר מחבר בין שתי נקודות שונות.',
  EDGE_EXISTS: 'הנקודות האלה כבר מחוברות.',
  NODE_IN_USE: 'זו הכניסה של מקום. כדי למחוק אותה, מחקו את המקום בלשונית "מקומות".',

  // Routes
  NO_ROUTE: 'לא נמצא מסלול. ייתכן שמעבר חסום כרגע.',
  ROUTING_UNAVAILABLE: 'שירות הניווט לא זמין כרגע. נסו שוב בעוד רגע.',
  ROUTING_ERROR: 'חישוב המסלול נכשל. נסו שוב.',
};

// The fields the server checks, by the name the user sees on the form
const FIELD_LABELS: Record<string, string> = {
  name: 'שם',
  type: 'סוג',
  category: 'קטגוריה',
  hours: 'שעות פתיחה',
  url: 'אתר אינטרנט',
  floor: 'קומה',
  x: 'מיקום במפה',
  y: 'מיקום במפה',
  address: 'רחוב ומספר',
  city: 'עיר',
  alert_area: 'אזור התרעה',
  floors_count: 'מספר הקומות',
  svg: 'קובץ התוכנית',
  label: 'שם',
  connectorId: 'מזהה',
  username: 'שם משתמש',
  email: 'אימייל',
  password: 'סיסמה',
};

// The Hebrew message of a server error code, or null for a code we don't know
export function getMessageForCode(code: string): string | null {
  return MESSAGES[code] ?? null;
}

// "This is the entrance of "Sea Fashion". Delete the place instead." -> Sea Fashion
function getQuotedName(message: string): string | null {
  const match = message.match(/"(.+)"/);
  return match ? match[1] : null;
}

// A message the user can read, from any error.
// fallback: what this screen says when it can't tell more ("לא הצלחנו לשמור את המקום. נסו שוב.").
export function getErrorMessage(error: unknown, fallback = 'משהו השתבש. נסו שוב.'): string {
  if (!(error instanceof ApiError)) {
    // fetch itself failed: no internet, or the server is down / waking up
    return fallback;
  }

  // The first field that failed, by its name on the form
  if (error.code === 'VALIDATION_ERROR') {
    const field = Object.keys(error.fields)[0];
    const label = field ? FIELD_LABELS[field] : undefined;
    return label ? `הערך בשדה "${label}" לא תקין.` : 'אחד השדות לא תקין. בדקו את הפרטים ונסו שוב.';
  }

  // The server names the place in its message, so we can name it too
  if (error.code === 'NODE_IN_USE') {
    const placeName = getQuotedName(error.message);
    if (placeName) {
      return `זו הכניסה של "${placeName}". כדי למחוק אותה, מחקו את המקום בלשונית "מקומות".`;
    }
  }

  return getMessageForCode(error.code) ?? fallback;
}
