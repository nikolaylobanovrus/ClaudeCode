// Ограничитель аварий: ловит ошибку рендера и показывает человеку внятный
// экран вместо белого.
//
// Зачем это появилось. 10.09.2026 в шаге «Расходы» обращение к полю, которого
// не было в старом черновике, кидало TypeError. Error boundary в приложении не
// было, поэтому React размонтировал всё дерево — человек жал «Далее» и видел,
// что «ничего не происходит». Валидация при этом молчала (она и правда была
// чистой), в Метрике ничего не появлялось, и поломка прожила сутки незамеченной.
//
// Поэтому здесь две задачи, и вторая важнее первой:
//   1. показать человеку, что делать, и не потерять черновик;
//   2. СООБЩИТЬ нам, что авария вообще была.
import { Component } from "react";
import { ymGoal } from "../lib/metrika.js";

// В сообщение об ошибке может затесаться то, чему не место в аналитике:
// суммы, ИНН, номер счёта. Режем любые длинные числа и ограничиваем длину.
// Имена свойств («reading 'byAgent'») при этом сохраняются — ради них всё и
// затевается, по ним поломка ищется за минуту.
function safeMessage(error) {
  const raw = String(error?.message || error || "");
  return raw.replace(/\d{4,}/g, "…").slice(0, 120);
}

// Признаки того, что не загрузился кусок бандла, а не сломался наш код.
// Формулировки у браузеров разные, поэтому проверяем все известные.
function isStaleChunk(error) {
  const m = String(error?.message || error || "");
  return (
    /Importing a module script failed/i.test(m) ||
    /Failed to fetch dynamically imported module/i.test(m) ||
    /error loading dynamically imported module/i.test(m) ||
    /Unable to preload CSS/i.test(m) ||
    /ChunkLoadError/i.test(m)
  );
}

const RELOAD_KEY = "ns.reloaded";

// true — перезагружаться можно (в этой вкладке ещё не перезагружались).
// Приватный режим и запрет хранения роняют sessionStorage: там лучше НЕ
// перезагружаться вовсе, чем зациклиться без возможности это запомнить.
function markReloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Выкатили новую версию, а у человека открыта старая страница: адреса
    // кусков бандла содержат хеш содержимого, старые после выкладки исчезают,
    // и ленивая подгрузка шага падает — «Importing a module script failed».
    // Человек при этом ничего не делал неправильно, а перезагрузка страницы
    // чинит это полностью. 11.09.2026 так оборвался ровно один визит с
    // телефона; поймали только потому, что теперь есть цель render_error.
    //
    // Перезагружаемся сами, но ровно один раз за вкладку: если дело не в
    // выкладке, второй заход даст ту же ошибку, и цикл перезагрузок был бы
    // хуже самой аварии.
    if (isStaleChunk(error) && markReloadOnce()) {
      ymGoal("stale_reload", { where: this.props.where || "app" });
      window.location.reload();
      return;
    }
    ymGoal("render_error", {
      where: this.props.where || "app",
      error: `${error?.name || "Error"}: ${safeMessage(error)}`,
    });
    // Консоль оставляем: при разборе по записи Вебвизора это единственное
    // место, где виден стек компонентов.
    console.error("Сбой рендера:", this.props.where || "app", error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    // Сменился шаг (или другой ключ) — пробуем показать содержимое снова.
    // Без этого человек, нажавший «Назад», остался бы на экране с ошибкой.
    if (prev.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" role="alert" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Здесь что-то сломалось у нас</h3>
        <p>
          {this.props.hint ||
            "Это ошибка на нашей стороне, а не в ваших данных."}{" "}
          <strong>Всё, что вы ввели, сохранено</strong> — черновик анкеты
          хранится в этом браузере и от сбоя не пострадал.
        </p>
        <p>
          Попробуйте вернуться на шаг назад или обновить страницу. Если не
          помогло — напишите нам, мы поправим и доведём вашу декларацию до
          конца руками.
        </p>
        <div className="doc-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }
}
