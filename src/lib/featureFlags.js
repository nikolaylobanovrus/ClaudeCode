// Серверные флаги фич (таблица feature_flags + RPC feature_enabled).
// Fail-closed: флаг выключен, база недоступна или запрос упал → false,
// зависимые блоки не рендерятся и сайт выглядит как без фичи.
// Киллсвитч: docs/anthropic-setup.md.
import { useEffect, useState } from "react";
import { sbRpc } from "./supabase.js";

// Кэш промисов на уровне модуля: сколько бы компонентов на странице ни
// спросили один флаг — RPC уйдёт один раз за загрузку страницы.
const cache = new Map();

export function featureEnabled(key) {
  if (!cache.has(key)) {
    const p = sbRpc("feature_enabled", { p_key: key })
      .then((v) => v === true)
      .catch(() => {
        // Сетевую ошибку не кэшируем: следующий маунт попробует снова.
        cache.delete(key);
        return false;
      });
    cache.set(key, p);
  }
  return cache.get(key);
}

export function useFeatureFlag(key) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    featureEnabled(key).then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, [key]);
  return on;
}
