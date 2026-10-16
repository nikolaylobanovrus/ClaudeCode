import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Deductions from "./pages/Deductions.jsx";
import Pricing from "./pages/Pricing.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import Contacts from "./pages/Contacts.jsx";
import Privacy from "./pages/Privacy.jsx";
import Offer from "./pages/Offer.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import ChooseSituation from "./pages/ChooseSituation.jsx";
import SituationIpoteka from "./pages/SituationIpoteka.jsx";
import SituationKvartira from "./pages/SituationKvartira.jsx";
import SituationLechenie from "./pages/SituationLechenie.jsx";
import SituationInostrannym from "./pages/SituationInostrannym.jsx";
import SituationProdazha from "./pages/SituationProdazha.jsx";
import SituationInaya from "./pages/SituationInaya.jsx";
import { lazy, Suspense } from "react";
import Cabinet from "./pages/Cabinet.jsx";
import Operator from "./pages/Operator.jsx";
import NotFound from "./pages/NotFound.jsx";

// Мастер декларации — самый тяжёлый раздел (8 шагов, валидация, расчёт):
// грузим его чанк только при заходе на /deklaraciya, чтобы не замедлять
// маркетинговые страницы.
const SelfService = lazy(() => import("./pages/SelfService.jsx"));
const SelfServiceTariffs = lazy(() => import("./pages/SelfServiceTariffs.jsx"));
const SelfServiceContacts = lazy(() => import("./pages/SelfServiceContacts.jsx"));
const Wizard = lazy(() => import("./pages/Wizard.jsx"));
const SelfServiceInstrukciya = lazy(() => import("./pages/SelfServiceInstrukciya.jsx"));
const SelfServiceVychetKvartira = lazy(() => import("./pages/SelfServiceVychetKvartira.jsx"));
const SelfServiceVychetIpoteka = lazy(() => import("./pages/SelfServiceVychetIpoteka.jsx"));
const SelfServiceVychetLechenie = lazy(() => import("./pages/SelfServiceVychetLechenie.jsx"));
const SelfServiceVychetObuchenie = lazy(() => import("./pages/SelfServiceVychetObuchenie.jsx"));
const SelfServiceNalogProdazhaRealty = lazy(() => import("./pages/SelfServiceNalogProdazhaRealty.jsx"));
const SelfServiceNalogProdazhaAuto = lazy(() => import("./pages/SelfServiceNalogProdazhaAuto.jsx"));
const SelfServiceVychetDeti = lazy(() => import("./pages/SelfServiceVychetDeti.jsx"));
const SelfServiceVychetSport = lazy(() => import("./pages/SelfServiceVychetSport.jsx"));
const SelfServiceVychetIis = lazy(() => import("./pages/SelfServiceVychetIis.jsx"));
const SelfServiceVychetStrahovanie = lazy(() => import("./pages/SelfServiceVychetStrahovanie.jsx"));
const SelfServiceVychetSberezheniya = lazy(() => import("./pages/SelfServiceVychetSberezheniya.jsx"));
const SelfServiceKalkulyator = lazy(() => import("./pages/SelfServiceKalkulyator.jsx"));
const SelfServiceOffer = lazy(() => import("./pages/SelfServiceOffer.jsx"));
const lazyPage = (el) => <Suspense fallback={null}>{el}</Suspense>;

// Редирект с сохранением запроса: <Navigate to="..."> отбрасывает search.
function RedirectTo({ to }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Главная — сервис самозаполнения (199 ₽): весь платящий трафик и
            прямые заходы «запомнил из рекламы» идут сюда. «Под ключ» — на
            /pod-klyuch (решение владельца, июль 2026; позже переедет на
            отдельный домен nalog-service.online). */}
        <Route index element={lazyPage(<SelfService />)} />
        <Route path="pod-klyuch" element={<Home />} />
        <Route path="vychety" element={<Deductions />} />
        <Route path="tarify" element={<Pricing />} />
        <Route path="kak-rabotaem" element={<HowItWorks />} />
        <Route path="kontakty" element={<Contacts />} />
        <Route path="registraciya" element={<Register />} />
        <Route path="vhod" element={<Login />} />
        <Route path="vyberite-situaciyu" element={<ChooseSituation />} />
        <Route path="situaciya/ipoteka" element={<SituationIpoteka />} />
        <Route path="situaciya/kvartira" element={<SituationKvartira />} />
        <Route path="situaciya/lechenie-obuchenie" element={<SituationLechenie />} />
        <Route path="situaciya/inostrannym" element={<SituationInostrannym />} />
        <Route path="situaciya/prodazha" element={<SituationProdazha />} />
        <Route path="situaciya/inaya" element={<SituationInaya />} />
        <Route path="kabinet" element={<Cabinet />} />
        <Route path="operator" element={<Operator />} />
        {/* Старый адрес лендинга: сюда ведут 88 из 109 объявлений Директа —
            редирект сохраняет их работоспособность без перемодерации.
            Запрос переносим: до перехода на чистые URL метки жили ВНЕ решётки
            и редирект их не касался, а теперь они в запросе пути — обычный
            <Navigate to="/"> выбросил бы utm у восьми из десяти платных
            визитов, и вся атрибуция в Метрике поехала бы. */}
        <Route path="deklaraciya" element={<RedirectTo to="/" />} />
        <Route path="deklaraciya/tarify" element={lazyPage(<SelfServiceTariffs />)} />
        <Route path="deklaraciya/kontakty" element={lazyPage(<SelfServiceContacts />)} />
        <Route path="deklaraciya/anketa" element={lazyPage(<Wizard />)} />
        <Route path="deklaraciya/instrukciya" element={lazyPage(<SelfServiceInstrukciya />)} />
        {/* Лендинг под поисковый спрос «вычет за квартиру»: сайт находят
            только по названию, страниц-ответов на вопросы людей нет. */}
        <Route
          path="deklaraciya/vychet-za-kvartiru"
          element={lazyPage(<SelfServiceVychetKvartira />)}
        />
        <Route
          path="deklaraciya/vychet-za-ipoteku"
          element={lazyPage(<SelfServiceVychetIpoteka />)}
        />
        <Route
          path="deklaraciya/vychet-za-lechenie"
          element={lazyPage(<SelfServiceVychetLechenie />)}
        />
        <Route
          path="deklaraciya/vychet-za-obuchenie"
          element={lazyPage(<SelfServiceVychetObuchenie />)}
        />
        <Route
          path="deklaraciya/nalog-s-prodazhi-kvartiry"
          element={lazyPage(<SelfServiceNalogProdazhaRealty />)}
        />
        <Route
          path="deklaraciya/nalog-s-prodazhi-avtomobilya"
          element={lazyPage(<SelfServiceNalogProdazhaAuto />)}
        />
        <Route path="deklaraciya/vychet-na-detey" element={lazyPage(<SelfServiceVychetDeti />)} />
        <Route path="deklaraciya/vychet-za-sport" element={lazyPage(<SelfServiceVychetSport />)} />
        <Route path="deklaraciya/vychet-po-iis" element={lazyPage(<SelfServiceVychetIis />)} />
        <Route path="deklaraciya/vychet-za-strahovanie-zhizni" element={lazyPage(<SelfServiceVychetStrahovanie />)} />
        <Route path="deklaraciya/vychet-po-pds" element={lazyPage(<SelfServiceVychetSberezheniya />)} />
        <Route
          path="deklaraciya/kalkulyator-naloga-s-prodazhi"
          element={lazyPage(<SelfServiceKalkulyator />)}
        />
        <Route path="deklaraciya/oferta" element={lazyPage(<SelfServiceOffer />)} />
        {/* Вход оператора лежит на /operator, но набирают его по-разному.
            «/deklaraciya/operator» — по аналогии с остальным разделом (за
            месяц один такой заход в Метрике), «/mama» — короткий адрес,
            который легко продиктовать и набрать с телефона. До этапа C оба
            молча отдавали главную с кодом 200, теперь отдавали бы честный
            404 — поэтому их надо обслужить явно. */}
        <Route path="deklaraciya/operator" element={<RedirectTo to="/operator" />} />
        <Route path="mama" element={<RedirectTo to="/operator" />} />
        <Route path="politika-konfidencialnosti" element={<Privacy />} />
        <Route path="publichnaya-oferta" element={<Offer />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
