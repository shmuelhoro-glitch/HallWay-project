# InRoute – חוזה ה-API

הקובץ הזה מתאר בדיוק מה הלקוח שולח ומה הוא מצפה לקבל, לפי הקוד שכתוב בפרונט. שדה בשם אחר, או אובייקט במקום מערך, ישברו את המסך.

## כללים לכל הנתיבים

- **כתובת הבסיס:** `VITE_API_URL` בלקוח, למשל `http://localhost:3000`.
- **התחברות:** משתמש מחובר שולח בכל בקשה את הכותרת `Authorization: Bearer <token>`. הטוקן מגיע מ-login.
- **שגיאות:** תמיד בצורה הזו, דרך ה-`errorHandler`:
  ```json
  { "error": { "code": "NODE_NOT_FOUND", "message": "Node not found", "fields": {} } }
  ```
  הלקוח מחליט מה להציג לפי `code`. את `message` כותבים באנגלית, כי בחלק מהמקומות היא מוצגת למשתמש כמו שהיא.
- **מזהים:**
  - ממה שבא מ-Supabase חוזר `id`. אלה המבנים והמשתמשים.
  - ממה שבא מ-MongoDB חוזר `_id`. אלה המקומות וההודעות.
  - כל המזהים חוזרים כמחרוזת. `res.json` הופך ObjectId למחרוזת לבד.
- **CORS:**
  - הלקוח רץ על פורט אחר, אז צריך `cors({ origin: process.env.CLIENT_URL })`, גם ב-Express וגם ב-Socket.IO.
  - הכותרת `Authorization` חייבת להיות מותרת.
- **גודל גוף הבקשה:** `express.json({ limit: '5mb' })`, בגלל העלאת שרטוטים.
- **הרשאות:** כרגע כל משתמש מחובר יכול לנהל מבנה, ולכן על נתיבי הניהול מספיק `requireAuth`.

## חיבור ב-app.js

```js
app.use('/api/auth', authRoutes);
app.use('/api/buildings', buildingsRoutes);
app.use('/api/buildings/:buildingId/places', placesRoutes);
app.use('/api/buildings/:buildingId/graph', graphRoutes);
app.use('/api/buildings/:buildingId/qr', qrRoutes);
app.use('/api/buildings/:buildingId/analytics', analyticsRoutes);
app.use('/api/buildings/:buildingId/chat', chatRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/alerts', alertsRoutes);
```

בחמשת הראוטרים שהבסיס שלהם מכיל `:buildingId` צריך `express.Router({ mergeParams: true })`.

## כל הנתיבים

הנתיבים שמסומנים ב-✔ הלקוח של צד המבקר כבר קורא להם. החוזה המפורט שלהם מופיע בהמשך.

| שיטה | נתיב | מי רשאי | פונקציה | |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | כולם | `register` | ✔ |
| POST | `/api/auth/login` | כולם | `login` | ✔ |
| GET | `/api/buildings?city=&type=` | כולם | `getBuildings` | ✔ |
| GET | `/api/buildings/:buildingId` | כולם | `getBuildingById` | ✔ |
| GET | `/api/buildings/:buildingId/floors/:floor/plan.svg` | כולם | `getFloorPlan` | ✔ |
| POST | `/api/buildings` | מחובר | `createBuilding` | |
| POST | `/api/buildings/:buildingId/floors` | מחובר | `addFloor` | |
| POST | `/api/buildings/:buildingId/admins` | מחובר | `createBuildingAdmin` | |
| GET | `/api/buildings/:buildingId/places?q=&category=&floor=` | כולם | `getPlaces` | ✔ |
| POST | `/api/buildings/:buildingId/places` | מחובר | `createPlace` | |
| PUT | `/api/buildings/:buildingId/places/:placeId` | מחובר | `updatePlace` | |
| DELETE | `/api/buildings/:buildingId/places/:placeId` | מחובר | `deletePlace` | |
| GET | `/api/buildings/:buildingId/graph?floor=` | מחובר | `getGraph` | |
| POST | `/api/buildings/:buildingId/graph/nodes` | מחובר | `createNode` | |
| PUT | `/api/buildings/:buildingId/graph/nodes/:nodeId` | מחובר | `updateNode` | |
| DELETE | `/api/buildings/:buildingId/graph/nodes/:nodeId` | מחובר | `deleteNode` | |
| POST | `/api/buildings/:buildingId/graph/edges` | מחובר | `createEdge` | |
| PATCH | `/api/buildings/:buildingId/graph/edges/:edgeId` | מחובר | `setEdgeBlocked` | |
| DELETE | `/api/buildings/:buildingId/graph/edges/:edgeId` | מחובר | `deleteEdge` | |
| GET | `/api/buildings/:buildingId/qr/:nodeId` | מחובר | `getQrCode` | |
| GET | `/api/buildings/:buildingId/analytics` | מחובר | `getAnalytics` | |
| GET | `/api/buildings/:buildingId/chat/messages?limit=50` | כולם | `getMessages` | ✔ |
| DELETE | `/api/buildings/:buildingId/chat/messages/:messageId` | מחובר | `deleteMessage` | |
| POST | `/api/buildings/:buildingId/chat/bans` | מחובר | `banUser` | |
| POST | `/api/navigation/route` | כולם | `getRoute` | ✔ |
| POST | `/api/navigation/nearest-shelter` | כולם | `getNearestShelter` | ✔ |
| GET | `/api/navigation/nodes/:nodeId` | כולם | `getNode` | ✔ |
| GET | `/api/alerts/areas?q=` | מחובר | `searchAlertAreas` | |
| POST | `/api/alerts/simulate` | מחובר | `simulateAlert` | |

שני נתיבים נוספו מאז הגרסה הקודמת של הקובץ:
- **`plan.svg`:** מגיש את השרטוט של הקומה למפה.
- **`nodes/:nodeId`:** כשנכנסים מקוד QR יש רק מזהה של צומת. הנתיב מחזיר את הקומה ואת x ו-y שלו, כדי שאפשר יהיה לצייר "You are here".

---

## החוזה המפורט של מה שהלקוח משתמש בו

### POST /api/auth/register

גוף הבקשה. את `role` הלקוח לא שולח, ולכן השרת שם ברירת מחדל `visitor`:
```json
{ "username": "dana_levi", "email": "dana@example.com", "password": "Demo12345" }
```
**תשובה:** 201. הלקוח לא קורא את התוכן. אחרי ההרשמה הוא קורא ל-login לבד.

**שגיאות:**

| סטטוס | code |
| --- | --- |
| 400 | `VALIDATION_ERROR` |
| 409 | `EMAIL_TAKEN` |
| 409 | `USERNAME_TAKEN` |

### POST /api/auth/login

גוף הבקשה:
```json
{ "email": "dana@example.com", "password": "Demo12345" }
```
**תשובה 200:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "username": "dana_levi",
    "email": "dana@example.com",
    "role": "visitor",
    "buildings": [{ "id": "uuid", "name": "Sea Mall", "city": "Tel Aviv" }]
  }
}
```
**שגיאות:**

| סטטוס | code |
| --- | --- |
| 400 | `VALIDATION_ERROR` |
| 401 | `INVALID_CREDENTIALS` |
| 423 | `ACCOUNT_LOCKED` |

### GET /api/buildings?city=&type=

- **`city`:** חיפוש חלקי בלי הבדל בין אותיות גדולות לקטנות: `.ilike('city', `%${city}%`)`.
- **`type`:** אחד מ-`mall`, `hospital` או `campus`.
- **מתי נשלחים:** הלקוח שולח כל אחד מהם רק כשיש בו ערך.

**תשובה 200: מערך**, לא אובייקט שעוטף אותו:
```json
[
  {
    "id": "uuid",
    "name": "Sea Mall",
    "type": "mall",
    "address": "Ibn Gabirol St 10",
    "city": "Tel Aviv",
    "lat": 32.07988,
    "lng": 34.78162,
    "floors_count": 3
  }
]
```

### GET /api/buildings/:buildingId

**תשובה 200:** המבנה, ובנוסף רשימת הקומות שלו מ-MongoDB, בלי תוכן ה-SVG:
```json
{
  "id": "uuid", "name": "Sea Mall", "type": "mall", "address": "...", "city": "Tel Aviv",
  "lat": 32.07988, "lng": 34.78162, "floors_count": 3,
  "floors": [
    { "floor": 0, "name": "Ground floor", "width": 640, "height": 1000 },
    { "floor": 1, "name": "Floor 1", "width": 640, "height": 1000 }
  ]
}
```
**שגיאות:** 404 `BUILDING_NOT_FOUND`.

`width` ו-`height` הם ה-viewBox של השרטוט. כל ה-x וה-y של מקומות וצמתים נמדדים ביחידות האלה.

### GET /api/buildings/:buildingId/floors/:floor/plan.svg

**תשובה 200:** `Content-Type: image/svg+xml`, והגוף הוא השרטוט עצמו. כדאי להוסיף את הכותרת `Content-Security-Policy: script-src 'none'`, כדי שסקריפט שמוחבא בשרטוט לא ירוץ גם אם מישהו פותח את הקובץ ישירות בדפדפן.

**שגיאות:** 404 `FLOOR_NOT_FOUND`.

### POST /api/buildings/:buildingId/floors

זה הנתיב של מסך הניהול. הוא כאן כי מבנה בלי קומות לא נפתח אצל המבקר.

גוף הבקשה. `svg` הוא תוכן הקובץ כטקסט:
```json
{ "floor": 0, "name": "Ground floor", "svg": "<svg viewBox=\"0 0 640 1000\">...</svg>" }
```
**מה השרת עושה:**
- חותך כל מה שבא לפני `<svg`.
- קורא את הרוחב והגובה מה-`viewBox`.
- שומר ב-`floors` עם upsert, כך שהעלאה חוזרת של אותה קומה מחליפה את השרטוט הישן.

**תשובה 201:**
```json
{ "floor": 0, "name": "Ground floor", "width": 640, "height": 1000 }
```
**שגיאות:** 400 `INVALID_SVG`, כשאין `<svg` או שאין `viewBox`.

### GET /api/buildings/:buildingId/places?q=&category=&floor=

כל הפרמטרים לא חובה. בלי פרמטרים חוזרים כל המקומות של המבנה, והלקוח צריך את כולם בשביל המפה ו"I'm near...".

- **`q`:** חיפוש חלקי בשם, אחרי ניטרול תווים מיוחדים: `q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.
- **`category`:** התאמה מדויקת.
- **`floor`:** מגיע כמחרוזת, אז ממירים עם `Number(floor)`.

**תשובה 200: מערך:**
```json
[
  {
    "_id": "6603...",
    "buildingId": "uuid",
    "floor": 1,
    "name": "Pharm Plus",
    "type": "store",
    "category": "Health",
    "x": 252,
    "y": 124,
    "hours": "Sun-Thu 09:00-21:00",
    "url": "https://example.com/pharm-plus",
    "isLandmark": true,
    "entryNodeId": "6601..."
  }
]
```
**השדות:**

| שדה | מה הוא |
| --- | --- |
| `type` | `store`, `service` או `shelter` |
| `hours`, `url` | לא חובה |
| `entryNodeId` | המזהה של צומת הכניסה של המקום, כמחרוזת |

### GET /api/buildings/:buildingId/chat/messages?limit=50

**תשובה 200:** מערך של ההודעות האחרונות. אין חשיבות לסדר, כי הלקוח ממיין לפי `createdAt`.
```json
[
  {
    "_id": "...",
    "buildingId": "uuid",
    "userId": "uuid",
    "username": "dana_levi",
    "text": "Hi!",
    "createdAt": "2026-10-11T12:40:00.000Z"
  }
]
```

### POST /api/navigation/route

גוף הבקשה. אחת משתי הצורות:
```json
{ "buildingId": "uuid", "fromNodeId": "6601...", "toPlaceId": "6603..." }
{ "buildingId": "uuid", "fromNodeId": "6601...", "toNodeId": "6601..." }
```
- **`toPlaceId`:** ניווט למקום. השרת מוצא את ה-`entryNodeId` של המקום ושולח אותו לשירות ה-Python.
- **`toNodeId`:** "נווט אליי". הצומת נשלח כמו שהוא.

**תשובה 200:**
```json
{
  "path": [
    { "id": "6601...", "floor": 0, "x": 320, "y": 40 },
    { "id": "6601...", "floor": 0, "x": 320, "y": 124 },
    { "id": "6601...", "floor": 1, "x": 252, "y": 454 }
  ],
  "length": 512.4
}
```
- **סדר ה-`path`:** מנקודת המוצא ועד היעד.
- **מעבר קומה:** הלקוח מזהה אותו לבד, כששני צמתים רצופים נמצאים בקומות שונות.

**שגיאות:**

| סטטוס | code | מתי |
| --- | --- | --- |
| 404 | `NO_ROUTE` | אין מסלול. הלקוח מציג "No route found". מקובל גם להחזיר `{ "path": null }` |
| 404 | `PLACE_NOT_FOUND` | המקום לא קיים |
| 503 | `ROUTING_UNAVAILABLE` | שירות ה-Python לא ענה |

**רישום:** כל בקשה נשמרת ב-`route_requests`.

### POST /api/navigation/nearest-shelter

גוף הבקשה:
```json
{ "buildingId": "uuid", "fromNodeId": "6601..." }
```
**תשובה:** בדיוק כמו ב-`/route`.

הצומת האחרון ב-`path` חייב להיות ה-`entryNodeId` של המרחב המוגן. ככה הלקוח מוצא את השם שלו ומציג "Walk to Protected Space 1".

### GET /api/navigation/nodes/:nodeId

**תשובה 200:**
```json
{ "id": "6601...", "buildingId": "uuid", "floor": 0, "x": 320, "y": 40, "label": "North entrance" }
```
**שגיאות:** 404 `NODE_NOT_FOUND`. גם מזהה שהוא לא ObjectId תקין מחזיר 404, ולא 500. בודקים עם `mongoose.isValidObjectId`.

---

## Socket.IO

**החיבור:** על אותו שרת HTTP של Express. הלקוח מתחבר ככה:
```js
io(API_URL, { auth: { token } }) // אורח מתחבר עם auth: {}
```
**`io.use` בשרת:**
- אם יש טוקן, מאמתים אותו ושומרים ב-`socket.data.user` את `{ userId, username, role }`.
- את ה-`username` אין בטוקן. מביאים אותו מטבלת `users` פעם אחת, בזמן החיבור.
- אורח מתחבר בלי טוקן, ויכול רק לקרוא.

| אירוע | כיוון | מה נשלח | מה השרת עושה |
| --- | --- | --- | --- |
| `chat:join` | לקוח → שרת | `{ buildingId }` | `socket.join('building:' + buildingId)`. הלקוח שולח אותו בכל התחברות, גם אחרי ניתוק |
| `chat:send` | לקוח → שרת | `{ buildingId, text }` | בודק ששולח מחובר, שהוא לא חסום, שלא שלח יותר מ-5 הודעות ב-10 שניות ושההודעה עד 500 תווים. שומר ב-`messages` ומשדר `chat:message` לחדר |
| `chat:message` | שרת → חדר | ההודעה שנשמרה, באותה צורה כמו ב-GET messages | |
| `chat:error` | שרת → השולח בלבד | `{ code, message }` | ה-code אחד מ-`NOT_LOGGED_IN`, `BANNED`, `RATE_LIMITED`, `TOO_LONG`. ה-message באנגלית, כי הוא מוצג כמו שהוא |
| `alert:start` | שרת → חדר | `{ title, category, countdown }` | למשל `{ "title": "Rockets and missiles", "category": "missiles", "countdown": 90 }`. `countdown` הוא מספר השניות מ-`cities.json` של האזור |
| `alert:end` | שרת → חדר | בלי תוכן | הלקוח מחליף את החלון ב-"The event has ended" |

---

## שירות הניווט ב-Python (פנימי, רק השרת הראשי פונה אליו)

כל בקשה בלי הכותרת `X-Internal-Key` הנכונה מקבלת 401.

| שיטה | נתיב | גוף | תשובה |
| --- | --- | --- | --- |
| POST | `/route` | `{ buildingId, fromNodeId, toNodeId }` | `{ path: [{ id, floor, x, y }], length }`. כשאין מסלול, `path` הוא `null` |
| POST | `/nearest-shelter` | `{ buildingId, fromNodeId }` | אותו דבר |

**איך הגרף נבנה:**
- הקשתות נכנסות בשני הכיוונים.
- קשתות חסומות לא נכנסות.
- צמתים עם אותו `connectorId` בקומות שונות מקבלים ביניהם קשת במשקל 30.
- ה-`id` במסלול הוא `str(node["_id"])`.
