# InRoute

ניווט בתוך מבנים סגורים, מהדפדפן, בלי להתקין אפליקציה.

המבקר סורק קוד QR שתלוי במבנה (קניון, בית חולים, קמפוס) ומקבל מפה של המבנה, חיפוש חנויות ומסלול הליכה עד היעד, כולל מעבר בין קומות. בעל המבנה מנהל בעצמו את המפה, החנויות ודרכי ההליכה.

> **סטטוס:** בפיתוח. פרויקט גמר בהנדסת תוכנה, המרכז החרדי להכשרה מקצועית.

אתר חי: https://www.shmuelhoro.co.il

---

## מה המערכת עושה היום

### מבקר
- **מפת מבנים:** מפת ישראל בעמוד הבית עם סיכה לכל מבנה, חיפוש לפי שם, עיר או כתובת, וסינון לפי סוג.
- **כניסה ב-QR:** כל קוד מוצב בנקודה ידועה במבנה, כך שהסריקה קובעת גם את המבנה וגם את נקודת המוצא.
- **חיפוש וסינון:** חנויות ושירותים לפי שם, קטגוריה וקומה.
- **ניווט:** המסלול הקצר ביותר עד היעד, מצויר על מפת הקומה, כולל מדרגות ומעליות.
- **נווטו אליי:** שליחת קישור למיקום שלך במבנה. מי שפותח אותו מקבל את הנקודה שלך כיעד.
- **בקשת גישת ניהול:** טופס פנייה למי שמנהל מבנה.

### מנהל מבנה
- הקמת מבנה: כתובת, אימות המיקום על מפה, ותוכניות קומה (SVG, PNG או JPG).
- זיהוי אוטומטי של חנויות מתוך תוכנית SVG.
- ניהול מקומות ונקודות עניין והצבתם על המפה.
- עורך מעברים: ציור, גרירה, חסימה, מחיקה, ביטול וביצוע מחדש, שכבות תצוגה והצמדה.
- בדיקת תקינות: מקומות שאין אליהם מסלול, קומות לא מחוברות, נתונים שבורים.
- הפקת קודי QR להדפסה.

מנהל עורך רק את המבנים שלו. בעלי המערכת (`super`) רואים את כולם ומאשרים פניות של מנהלים חדשים.

### עדיין לא בנוי בשרת
הממשק קיים בלקוח, אבל צד השרת עוד לא נכתב: צ'אט לכל מבנה, התרעות צבע אדום והדמיית אזעקה, ונתוני שימוש.

---

## ארכיטקטורה

```
  React client  ──HTTPS──►  Main server (Node.js, Express)  ──►  PostgreSQL (Supabase)
       │                            │                        ──►  MongoDB (Atlas)
       ▼                            │ internal HTTP
  OpenStreetMap tiles               ▼
                            Routing service (Python, FastAPI): A*, Dijkstra
```

- **השרת הראשי** מטפל במשתמשים, בהרשאות ובניהול המבנים, ומעביר בקשות ניווט לשירות הניווט.
- **שירות הניווט** אחראי רק על חישוב מסלולים. רק השרת הראשי פונה אליו, עם מפתח פנימי משותף.
- **Supabase** מחזיק מבנים, משתמשים ופניות. **MongoDB** מחזיק קומות, נקודות, מעברים ומקומות.

### האלגוריתמים
- **A\*:** ניווט ליעד ידוע. ההערכה היא מרחק בקו ישר עד היעד.
- **Dijkstra:** מסלול למרחב המוגן הקרוב מבין כמה. האלגוריתם עוצר במרחב המוגן הראשון שהוא מגיע אליו.

---

## טכנולוגיות

| שכבה | טכנולוגיה |
| --- | --- |
| לקוח | React, TypeScript, Vite, React Router, Leaflet, Zustand |
| שרת ראשי | Node.js, Express, Zod, JWT, bcrypt |
| שירות ניווט | Python, FastAPI, Pydantic |
| מסדי נתונים | PostgreSQL (Supabase), MongoDB (Atlas) |
| בדיקות | Node test runner, Vitest, pytest, NetworkX |
| פריסה | Vercel (לקוח), Render (שרת ראשי ושירות ניווט) |

שירותים חיצוניים: אריחי OpenStreetMap למפה, ו-Nominatim להמרת כתובת לקואורדינטות. נתוני המפה © תורמי OpenStreetMap.

---

## מבנה הריפו

```
client/                    # React + TypeScript
backend/
├── server/                # Node.js + Express
│   ├── routes/  controllers/  services/  repositories/
│   ├── middleware/        # הרשאות, אימות קלט, טיפול בשגיאות
│   ├── schemas/           # Zod
│   ├── scripts/           # tables.sql, seed.js, check-data.js
│   └── tests/
└── routing-service/       # Python + FastAPI
    ├── app/               # algorithms/, graph/, routers/
    └── tests/
render.yaml
```

---

## הרצה מקומית

דרישות: Node.js 22 ומעלה, Python 3.11 ומעלה.

```bash
# שרת ראשי
cd backend/server
cp .env.example .env      # ולמלא את הערכים
npm install
npm run dev

# שירות הניווט
cd backend/routing-service
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# לקוח
cd client
cp .env.example .env
npm install
npm run dev
```

### משתני סביבה

**backend/server/.env**

| משתנה | תיאור |
| --- | --- |
| `PORT` | פורט השרת הראשי |
| `MONGO_URI` | חיבור ל-MongoDB |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | חיבור ל-Supabase |
| `JWT_SECRET` | מפתח לחתימת טוקנים |
| `ROUTING_URL` | כתובת שירות הניווט, בלי `/` בסוף |
| `INTERNAL_API_KEY` | מפתח משותף עם שירות הניווט. חייב להיות זהה בשניהם |
| `CLIENT_URL` | כתובת הלקוח. קודי ה-QR מובילים אליה |

**backend/routing-service/.env:** `MONGO_URI`, `INTERNAL_API_KEY`

**client/.env:** `VITE_API_URL`

---

## בדיקות

```bash
cd backend/server && npm test
cd backend/routing-service && python -m pytest
cd client && npm test
```

בדיקת הנתונים שכבר במסד (קוראת בלבד, לא משנה כלום):

```bash
cd backend/server && npm run check-data
```

---

## עבודה בצוות

- כל פיצ'ר ב-branch נפרד, ומיזוג ל-`main` רק דרך Pull Request אחרי שהשותף השני עבר על הקוד.
- `main` תמיד במצב שעובד.

## צוות

- יאיר רוזנבליט
- שמואל הורביץ
