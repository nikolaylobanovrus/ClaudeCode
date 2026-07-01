import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "ns.cookie.accepted";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie" role="dialog" aria-label="Использование файлов cookie">
      <p>
        ООО «Информкарт» использует файлы cookie для персонализации сервисов и
        удобства пользования сайтом. Подробнее — в{" "}
        <Link to="/politika-konfidencialnosti">Политике конфиденциальности</Link>.
      </p>
      <button className="btn btn--primary" onClick={accept}>
        Принять
      </button>
    </div>
  );
}
