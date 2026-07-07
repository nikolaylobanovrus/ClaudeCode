import { Routes, Route } from "react-router-dom";
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
const Wizard = lazy(() => import("./pages/Wizard.jsx"));
const lazyPage = (el) => <Suspense fallback={null}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
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
        <Route path="deklaraciya" element={lazyPage(<SelfService />)} />
        <Route path="deklaraciya/tarify" element={lazyPage(<SelfServiceTariffs />)} />
        <Route path="deklaraciya/anketa" element={lazyPage(<Wizard />)} />
        <Route path="politika-konfidencialnosti" element={<Privacy />} />
        <Route path="publichnaya-oferta" element={<Offer />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
