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
import Cabinet from "./pages/Cabinet.jsx";
import Operator from "./pages/Operator.jsx";
import NotFound from "./pages/NotFound.jsx";

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
        <Route path="kabinet" element={<Cabinet />} />
        <Route path="operator" element={<Operator />} />
        <Route path="politika-konfidencialnosti" element={<Privacy />} />
        <Route path="publichnaya-oferta" element={<Offer />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
