// Тизер автозаполнения на шаге «Вычеты»: сам блок загрузки живёт на шаге
// «О вас», но часть пользователей уходит раньше — предупреждаем, что руками
// вводить не обязательно. Виден только при включённом флаге doc_autofill.
import { useFeatureFlag } from "../lib/featureFlags.js";

export default function AutofillTeaser() {
  const enabled = useFeatureFlag("doc_autofill");
  if (!enabled) return null;
  return (
    <div className="doc-note doc-note--ok" style={{ marginTop: 12 }}>
      📷 На следующем шаге можно загрузить фото документов — справки о доходах,
      договора, чеки об оплате — и анкета заполнится сама. Останется только
      проверить.
    </div>
  );
}
