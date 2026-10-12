import { Link } from 'react-router-dom';

// Any address that is not one of our screens
function NotFoundPage() {
  return (
    <div className="screen">
      <div className="screen-message">
        <h1 className="sheet-title">הדף לא נמצא</h1>
        <p>ייתכן שהקישור שגוי, או שהדף הוסר.</p>
        <Link to="/" className="btn btn-outline">
          חזרה למפה
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
