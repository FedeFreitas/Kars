"use client";
import Image from "next/image";
import { useState } from "react";
import { createLead } from "@/services/leads";
import { useToast } from "@/components/ToastProvider";

export default function Home() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    birthdate: "",
    phone: "",
    email: "",
    city: "",
    ear: "Nao",
    uber: "Nao",
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setOk(false);
    setShowConfirm(true);
  }

  async function confirmSubmit() {
    if (loading) return;
    setLoading(true);
    try {
      await createLead(form);
      setOk(true);
      setShowConfirm(false);
    } catch (e) {
      const msg = e?.message || "Erro ao enviar cadastro";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-full min-h-screen bg-neutral-50 text-neutral-900">
      {/* NAVBAR */}
      <header className="w-full bg-neutral-900 text-white py-3 shadow-lg fixed top-0 left-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between">
          {/* LOGO */}
          <div className="flex items-center gap-3">
            <Image src="/kars-logo.png" width={44} height={44} alt="Logo" />
            <span className="text-lg md:text-xl font-bold text-yellow-400">
              Kars
            </span>
          </div>
          {/* LINKS DESKTOP */}
          <nav className="hidden md:flex gap-8 text-sm font-medium">
            <a
              href="#como-funciona"
              className="hover:text-yellow-400  py-2  transition"
            >
              Como funciona
            </a>
            <a
              href="#por-que"
              className="hover:text-yellow-400  py-2 transition"
            >
              Por que a Kars
            </a>
            <a
              href="#parceiros"
              className="hover:text-yellow-400 py-2  transition"
            >
              Contato
            </a>
            {/* Bot o Login - Desktop */}
            <a
              href="/login"
              className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-full font-semibold shadow transition cursor-pointer"
            >
              Login
            </a>
          </nav>
          {/* BOT O LOGIN MOBILE */}
          <a
            href="/login"
            className="
        md:hidden 
        px-4 py-2 
        bg-yellow-400 
        text-black 
        rounded-full 
        shadow 
        font-semibold 
        text-sm
        hover:bg-yellow-500 
        transition 
        cursor-pointer
      "
          >
            Login
          </a>
        </div>
      </header>
      {/* HERO */}
      <section className="w-full px-4 md:px-6 pt-28 md:pt-32 pb-20 md:pb-28 bg-yellow-400 flex flex-col items-center text-center shadow-inner">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 max-w-3xl leading-tight">
          A MELHOR LOCADORA <br className="hidden sm:block" />
          PARA MOTORISTAS DE APLICATIVOS
        </h1>
        <p className="mt-5 max-w-2xl text-sm sm:text-base md:text-lg text-neutral-800 leading-relaxed">
          Aluguel de veículos com praticidade, conforto e segurança. A solução
          ideal para quem busca mobilidade sem burocracias.
        </p>
        <a
          href="#parceiros"
          className="mt-8 px-8 md:px-10 py-3.5 md:py-4 bg-neutral-900 text-white rounded-full shadow-xl hover:bg-neutral-800 transition-all text-base md:text-lg font-semibold"
        >
          ALUGUE CONOSCO →
        </a>
      </section>
      {/* PRA QUEM   A Kars */}
      <section className="max-w-6xl mx-auto py-16 md:py-24 px-4 md:px-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 md:mb-16">
          PARA QUEM É A KARS
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-10">
          {/* CARD 1 */}
          <div className="p-8 md:p-10 bg-neutral-100 rounded-2xl shadow-md border text-center flex flex-col items-center gap-4">
            {/* SVG 1 – COPIADO EXATAMENTE COMO ENVIADO */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="106.555"
              height="111.203"
              viewBox="0 0 106.555 111.203"
            >
              <g transform="translate(-445.735 -951.851)">
                <path
                  d="M530.034,1014.046c0,13.573-.128,27.147.062,40.717.078,5.529-3.7,8.349-8.356,8.29-13.875-.174-27.753-.061-41.63-.063-5,0-7.838-2.8-7.839-7.759q-.008-41.414,0-82.827c0-4.515,2.968-7.448,7.518-7.449q21.2,0,42.409,0c5.005,0,7.822,2.755,7.829,7.756Q530.057,993.379,530.034,1014.046Zm-3.733.047q0-20.51,0-41.019c0-3.389-1.034-4.4-4.478-4.4q-20.733,0-41.466,0c-3.306,0-4.347,1.051-4.347,4.385q0,40.865,0,81.729c0,3.45.993,4.463,4.415,4.465q20.733.008,41.467,0c3.447,0,4.409-.979,4.41-4.454Q526.3,1034.448,526.3,1014.093Z"
                  fill="#28292B"
                />
                <path
                  d="M461.064,963.831a6.41,6.41,0,0,1-6.376,6.443,6.456,6.456,0,1,1-.116-12.91A6.366,6.366,0,0,1,461.064,963.831Zm-6.533,2.712a2.678,2.678,0,0,0,2.8-2.667,2.753,2.753,0,1,0-5.5-.13A2.727,2.727,0,0,0,454.531,966.543Z"
                  fill="#28292B"
                />
                <path
                  d="M461.048,1020.3a4.881,4.881,0,0,1-.053,1.984c-.313.637-1.05,1.5-1.583,1.487a2.386,2.386,0,0,1-1.859-1.321,12.41,12.41,0,0,1,.005-4.445,2.383,2.383,0,0,1,1.851-1.329c.531-.015,1.291.847,1.579,1.485A5.608,5.608,0,0,1,461.048,1020.3Z"
                  fill="#28292B"
                />
                <path
                  d="M453.622,1027.571c-.623,0-1.247.014-1.869,0a1.793,1.793,0,0,1-.083-3.583,33.72,33.72,0,0,1,4.047.009,1.79,1.79,0,0,1-.07,3.568C454.974,1027.6,454.3,1027.57,453.622,1027.571Z"
                  fill="#28292B"
                />
                <path
                  d="M537.42,962.837a4.447,4.447,0,0,1-1.833-.046c-.69-.35-1.623-.993-1.682-1.585a2.289,2.289,0,0,1,1.31-1.847,13.37,13.37,0,0,1,4.585-.011,2.283,2.283,0,0,1,1.276,1.862c-.058.589-.98,1.25-1.668,1.573A5.145,5.145,0,0,1,537.42,962.837Z"
                  fill="#28292B"
                />
                <path
                  d="M541.234,966.607a16.429,16.429,0,0,1,.015-2,1.766,1.766,0,0,1,1.865-1.7,1.7,1.7,0,0,1,1.809,1.729c.056,1.279.06,2.564,0,3.843a1.685,1.685,0,0,1-1.769,1.759,1.759,1.759,0,0,1-1.919-1.789c-.056-.611-.01-1.23-.01-1.845Z"
                  fill="#28292B"
                />
                <path
                  d="M464.827,1027.565c-.675,0-1.463.218-2-.055-.681-.347-1.589-1.082-1.6-1.666a2.346,2.346,0,0,1,1.461-1.772,11.734,11.734,0,0,1,4.329.012,2.583,2.583,0,0,1,1.445,1.805c.181.954-.563,1.608-1.609,1.669C466.18,1027.6,465.5,1027.565,464.827,1027.565Z"
                  fill="#28292B"
                />
                <path
                  d="M461.049,1031.379a19.809,19.809,0,0,1-.013,2.01,1.641,1.641,0,0,1-1.753,1.6,1.6,1.6,0,0,1-1.807-1.54,30.908,30.908,0,0,1-.018-4.173,1.805,1.805,0,0,1,3.6.087c.026.67.005,1.341.005,2.012Z"
                  fill="#28292B"
                />
                <path
                  d="M548.635,962.826a5.129,5.129,0,0,1-1.988-.051c-.654-.3-1.5-.956-1.568-1.536s.644-1.744,1.142-1.82a16.983,16.983,0,0,1,4.886-.025c.5.072,1.231,1.2,1.18,1.793s-.864,1.292-1.509,1.58A5.69,5.69,0,0,1,548.635,962.826Z"
                  fill="#28292B"
                />
                <path
                  d="M544.923,955.521c0,.666.223,1.45-.056,1.967-.356.658-1.1,1.5-1.709,1.523a2.32,2.32,0,0,1-1.8-1.365,11.381,11.381,0,0,1-.023-4.267,2.58,2.58,0,0,1,1.781-1.5c1.008-.192,1.725.554,1.813,1.644.053.662.009,1.331.009,2Z"
                  fill="#28292B"
                />
                <path
                  d="M447.7,989.894a1.943,1.943,0,0,1,1.99,1.946,1.869,1.869,0,0,1-1.985,1.939,1.838,1.838,0,0,1-1.971-1.936A1.909,1.909,0,0,1,447.7,989.894Z"
                  fill="#28292B"
                />
                <path
                  d="M548.339,986.175c1.157.139,1.923.723,1.912,1.965a1.946,1.946,0,0,1-3.891,0C546.356,986.942,547.106,986.286,548.339,986.175Z"
                  fill="#28292B"
                />
                <path
                  d="M524.456,1009.246q0,15.174,0,30.349c0,2.586-.476,3.053-3.1,3.054q-20.194,0-40.389,0c-2.608,0-3.1-.49-3.1-3.052q0-30.272,0-60.544c0-2.57.423-3,2.943-3h40.7c2.542,0,2.943.4,2.944,3Q524.46,994.149,524.456,1009.246Zm-42.791,29.6h38.978v-58.96H481.665Z"
                  fill="#28292B"
                />
                <path
                  d="M508.107,1051.018a6.527,6.527,0,1,1-6.524-6.512A6.5,6.5,0,0,1,508.107,1051.018Zm-6.516-2.785a2.769,2.769,0,0,0-2.8,2.714,2.784,2.784,0,0,0,5.567.045A2.778,2.778,0,0,0,501.591,1048.233Z"
                  fill="#28292B"
                />
                <path
                  d="M501.438,974.2c-1.035,0-2.073.041-3.1-.013a1.753,1.753,0,0,1-1.889-1.825,1.706,1.706,0,0,1,1.847-1.85c2.173-.036,4.347-.033,6.52,0a1.735,1.735,0,0,1,1.9,1.813A1.8,1.8,0,0,1,504.7,974.2C503.612,974.218,502.525,974.2,501.438,974.2Z"
                  fill="#28292B"
                />
                <path
                  d="M503.93,1007.333v-5.555c-1.7,0-3.333-.013-4.971.017a.778.778,0,0,0-.6.363c-.579,1.48-1.824,1.481-3.11,1.472-2.338-.017-4.678.013-7.016-.01-2.2-.022-2.917-.949-2.409-3.041,1.747-7.2,8.957-12.3,16.6-11.737a15.739,15.739,0,1,1-16.575,19.534c-.521-2,.1-2.873,2.14-2.894,2.7-.027,5.406-.047,8.107.023.61.016,1.566.259,1.747.667.55,1.242,1.466,1.214,2.527,1.171C501.509,1007.3,502.644,1007.333,503.93,1007.333Zm-13.671,1.873c1.32,4.795,7.155,7.959,12.953,7.139a12.07,12.07,0,0,0,10.067-11.849,12.206,12.206,0,0,0-11.1-11.926c-5.226-.45-11.082,3.111-11.932,7.381,1.779-.43,3.944.942,5.191-1.491.164-.321,1.026-.393,1.568-.4,2.753-.038,5.507-.027,8.26-.014,1.787.008,2.428.619,2.449,2.421q.049,4.1,0,8.2c-.021,1.7-.644,2.273-2.4,2.285-2.7.017-5.4-.014-8.1.014-1.107.011-2.076-.094-2.522-1.325a.905.905,0,0,0-.693-.417C492.763,1009.183,491.528,1009.206,490.259,1009.206Z"
                  fill="#28292B"
                />
                <path
                  d="M500.959,1035.009c-2.957,0-5.914.025-8.87-.008a4.6,4.6,0,1,1,.032-9.18q9.1-.048,18.206,0A4.595,4.595,0,1,1,510.3,1035C507.183,1035.037,504.071,1035.009,500.959,1035.009Zm.177-3.725c2.9,0,5.8.043,8.7-.04.5-.014.99-.557,1.485-.856-.454-.316-.9-.9-1.362-.908q-8.779-.093-17.56,0c-.479.006-.949.659-1.424,1.012.486.263.965.741,1.457.753C495.333,1031.321,498.235,1031.284,501.136,1031.284Z"
                  fill="#28292B"
                />
              </g>
            </svg>
            <p className="text-neutral-700 text-base md:text-lg">
              Deseja trabalhar com aplicativo de transporte de passageiros?
            </p>
          </div>
          {/* CARD 2 */}
          <div className="p-8 md:p-10 bg-neutral-100 rounded-2xl shadow-md border text-center flex flex-col items-center gap-4">
            {/* SVG 2 – COPIADO EXATAMENTE COMO ENVIADO */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="123.735"
              height="96.563"
              viewBox="0 0 123.735 96.563"
            >
              <g transform="translate(-756.949 -967.021)">
                <path
                  d="M861.039,1050.39H776.654c-.023.491-.06.932-.062,1.373-.006,2.421.022,4.843-.013,7.264a4.269,4.269,0,0,1-4.247,4.481c-2.25.1-4.512.1-6.762-.006a4.223,4.223,0,0,1-4.183-4.4q-.035-20.626.01-41.253a10.684,10.684,0,0,1,2.818-6.835c1.335-1.609,2.628-3.252,3.942-4.882-1.565.087-3.021.239-4.476.237a6.4,6.4,0,0,1-6.732-6.6,6.555,6.555,0,0,1,6.723-6.375c2.131-.021,4.327-.1,5.994,1.476a27.726,27.726,0,0,1,2.62,3.327c.068-.157.248-.524.388-.9q2.337-6.362,4.662-12.727c1.655-4.518,4.523-6.513,9.4-6.522q6.627-.011,13.253,0h1.595c.405-1.946.773-3.814,1.184-5.672a6.421,6.421,0,0,1,6.685-5.335q9.387-.02,18.776,0a6.423,6.423,0,0,1,6.609,5.274c.431,1.859.779,3.738,1.19,5.733,1.646,0,3.248-.013,4.849,0,3.955.037,7.919-.069,11.861.175,3.6.222,6.01,2.358,7.273,5.661,1.68,4.39,3.257,8.819,4.88,13.23.152.415.32.825.568,1.462.273-.642.43-1.091.646-1.51,1.436-2.783,3.882-3.625,6.859-3.694,3.071-.071,5.553.833,6.991,3.652a6.4,6.4,0,0,1-5.636,9.341c-1.546.053-3.1-.124-4.824-.2.873,1.087,1.74,2.2,2.64,3.282,1.82,2.2,3.643,4.387,3.968,7.369a21.705,21.705,0,0,1,.144,2.32q.012,19.6.005,39.2c0,3.544-1.673,5.211-5.219,5.217-1.749,0-3.5.018-5.246,0-2.968-.037-4.721-1.763-4.746-4.69C861.02,1056.068,861.039,1053.291,861.039,1050.39ZM775.3,1002.253h2.055q26.646,0,53.292,0a13.657,13.657,0,0,1,1.788.086,1.995,1.995,0,0,1-.031,3.95,13.862,13.862,0,0,1-1.789.083q-27.957.006-55.914-.016a2.464,2.464,0,0,0-2.219,1.011c-1.671,2.18-3.416,4.305-5.157,6.431a7.824,7.824,0,0,0-1.812,5.181c.028,7.31.006,14.62.013,21.929,0,3.559,1.754,5.3,5.344,5.3q8.9.012,17.81,0c.446,0,.891-.038,1.457-.064,0-1.292,0-2.472,0-3.651.013-3.439,1.614-5.052,5.048-5.053q23.609-.008,47.217,0c3.422,0,5.061,1.632,5.083,5.035.008,1.212,0,2.424,0,3.607a4.36,4.36,0,0,0,.611.119c6.442.005,12.886.043,19.328-.01a4.52,4.52,0,0,0,4.666-4.863c.024-7.538.007-15.077.008-22.615a7.267,7.267,0,0,0-1.637-4.691c-1.838-2.283-3.639-4.6-5.541-6.827a2.609,2.609,0,0,0-1.722-.782c-2.621-.083-5.245-.033-7.868-.037-2.217,0-3.094-.57-3.134-2.01-.04-1.483.894-2.11,3.167-2.114,2.244,0,4.488,0,6.933,0-.226-.673-.37-1.139-.537-1.6q-2.6-7.141-5.205-14.279c-1.232-3.376-2.435-4.218-6.029-4.218H793.509c-2.347,0-4.694-.011-7.041,0-2.806.018-4.227,1.016-5.184,3.635q-2.4,6.558-4.775,13.124C776.138,999.941,775.769,1000.963,775.3,1002.253Zm67.947,39.4H794.38v4.468h48.869Zm-11.5-63.695c-.321-1.606-.614-3.125-.929-4.639a2.386,2.386,0,0,0-2.5-2.107q-9.513-.036-19.025,0a2.355,2.355,0,0,0-2.49,2.1c-.3,1.518-.6,3.034-.921,4.641Zm-59.394,81.336v-8.67l-6.743-1.145v9.815Zm92.961-8.659v8.641h6.728v-9.816ZM764.487,1002.28l0-.06a11.378,11.378,0,0,0,1.239-.007,2.326,2.326,0,0,0,.059-4.648,10.794,10.794,0,0,0-2.873.106,2.063,2.063,0,0,0-1.789,2.258,2.163,2.163,0,0,0,1.991,2.244C763.567,1002.246,764.03,1002.246,764.487,1002.28Zm108.544.01,0-.076a10.638,10.638,0,0,0,1.238-.007,2.306,2.306,0,0,0,2.239-2.185,2.281,2.281,0,0,0-2.126-2.431,10.418,10.418,0,0,0-3.265.188,1.99,1.99,0,0,0-1.48,2.328,2.114,2.114,0,0,0,1.75,2.02A12.357,12.357,0,0,0,873.031,1002.29Z"
                  fill="#28292B"
                />
                <path
                  d="M818.916,1017.607q11.454,0,22.908.005c2.948.005,5.093,1.56,4.887,4a25.339,25.339,0,0,1-1.685,6.842c-.646,1.684-2.417,2.118-4.167,2.132-2.254.018-4.508.005-6.762.005h-36.57c-3.673,0-4.942-.981-5.807-4.5a35.94,35.94,0,0,1-.844-3.731,4.086,4.086,0,0,1,3.622-4.658,12.966,12.966,0,0,1,1.786-.1Q807.6,1017.6,818.916,1017.607Zm-23.971,4.2c.3,1.217.633,2.262.786,3.333s.714,1.265,1.686,1.259c5.747-.038,11.494-.019,17.24-.019q12.759,0,25.516-.017c.5,0,1.327-.14,1.426-.417.465-1.3.728-2.672,1.094-4.139Z"
                  fill="#28292B"
                />
                <path
                  d="M852.182,1023a7.6,7.6,0,1,1,7.65,7.508A7.582,7.582,0,0,1,852.182,1023Zm7.643-3.429a3.4,3.4,0,1,0,3.4,3.421A3.458,3.458,0,0,0,859.825,1019.568Z"
                  fill="#28292B"
                />
                <path
                  d="M785.445,1022.952a7.609,7.609,0,0,1-15.215.118,7.608,7.608,0,0,1,15.215-.118Zm-4.168-.051a3.41,3.41,0,0,0-3.47-3.334,3.455,3.455,0,0,0-3.405,3.417,3.415,3.415,0,0,0,3.555,3.388A3.377,3.377,0,0,0,781.277,1022.9Z"
                  fill="#28292B"
                />
                <path
                  d="M783.221,1037.249a4.279,4.279,0,0,1-4.262,4.3,4.346,4.346,0,0,1-4.3-4.149,4.286,4.286,0,0,1,4.221-4.336A4.217,4.217,0,0,1,783.221,1037.249Z"
                  fill="#28292B"
                />
                <path
                  d="M854.408,1037.216a4.205,4.205,0,0,1,4.374-4.15,4.279,4.279,0,0,1,4.187,4.364,4.35,4.35,0,0,1-4.335,4.117A4.268,4.268,0,0,1,854.408,1037.216Z"
                  fill="#28292B"
                />
                <path
                  d="M843.277,1002.261c.735,0,1.473-.036,2.206.009a1.912,1.912,0,0,1,1.958,1.92,1.827,1.827,0,0,1-1.754,2.078,38.059,38.059,0,0,1-5.088-.018,1.768,1.768,0,0,1-1.658-2.123,1.836,1.836,0,0,1,1.854-1.842c.821-.069,1.654-.014,2.482-.014Z"
                  fill="#28292B"
                />
              </g>
            </svg>
            <p className="text-neutral-700 text-base md:text-lg">
              Já é motorista e quer maximizar os seus ganhos?
            </p>
          </div>
          {/* CARD 3 */}
          <div className="p-8 md:p-10 bg-neutral-100 rounded-2xl shadow-md border text-center flex flex-col items-center gap-4">
            {/* SVG 3 – COPIADO EXATAMENTE COMO ENVIADO */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="100.017"
              height="99.636"
              viewBox="0 0 100.017 99.636"
            >
              <g transform="translate(-1088.612 -965.321)">
                <path
                  d="M1100.3,1057.654c-.245,1.857-.692,2.258-2.4,2.261-3.056.007-6.113,0-9.267,0v-3.281h8.175v-19.848h-8.19v-3.359c3.371,0,6.733-.023,10.093.031a1.477,1.477,0,0,1,1.149.685c.331,1.026,1.056.955,1.854.923a42.816,42.816,0,0,1,20.21,4.032,11.4,11.4,0,0,0,4.366.893c3.728.123,7.469.168,11.194,0,3.456-.152,6.8,1.6,7,6.338.47-.179.892-.325,1.3-.5,3.177-1.332,6.328-2.726,9.534-3.984a6.059,6.059,0,0,1,7.252,9,7.192,7.192,0,0,1-3,2.363c-8.853,3.452-17.711,6.9-26.659,10.105a27.961,27.961,0,0,1-20.678-.755C1108.281,1060.938,1104.329,1059.315,1100.3,1057.654Zm18.318-9.337h1.379q8.992,0,17.984,0c1.949,0,3.088-.941,3.062-2.511-.025-1.535-1.131-2.448-3-2.451-3.97-.007-7.945.11-11.908-.052a21.61,21.61,0,0,1-5.411-1.094c-2.3-.713-4.488-1.788-6.789-2.5-4.442-1.374-9.027-1.467-13.715-1.271,0,5.09-.016,10.089.039,15.087,0,.306.507.735.871.887q6.247,2.609,12.527,5.14a24.611,24.611,0,0,0,18.122.62c8.817-3.211,17.574-6.583,26.351-9.9,1.784-.675,2.54-2.18,1.941-3.722-.643-1.653-2.145-2.193-4.018-1.411-4.347,1.815-8.655,3.732-13.051,5.422a15.626,15.626,0,0,1-5.185,1.027c-5.953.123-11.909.047-17.865.047h-1.33Z"
                  fill="#28292B"
                />
                <path
                  d="M1156.959,1025.088v-3.276h1.278q7.861,0,15.725,0a11.17,11.17,0,0,0,10-16.389c-2.31-4.26-5.035-8.3-7.578-12.431-1.075-1.748-2.129-3.511-3.274-5.213a1.836,1.836,0,0,0-1.288-.716c-4.328-.053-8.657-.014-12.985-.049a1.524,1.524,0,0,0-1.5.857c-2.176,3.572-4.4,7.118-6.606,10.671-.224.36-.471.707-.751,1.127l-2.776-1.682c.244-.419.449-.788.671-1.148,2.2-3.558,4.383-7.127,6.623-10.661a6.231,6.231,0,0,0,.812-2.753,8.469,8.469,0,0,0-2.552-7.475,12.954,12.954,0,0,1-1.09-1.4c-1.871-2.46-1.655-5.025.606-7.2a6.616,6.616,0,0,1,7.883-1.252c1.46.71,2.89,1.486,4.378,2.132a2.1,2.1,0,0,0,1.508-.009c1.521-.669,2.981-1.472,4.48-2.192a6.786,6.786,0,0,1,9.719,5.666,3.162,3.162,0,0,1-.6,1.828c-1.18,1.679-2.506,3.258-3.681,4.941a4.622,4.622,0,0,0-.647,1.919c-.47,3.114.551,5.755,2.3,8.364,3.076,4.587,5.882,9.354,8.766,14.066a14.592,14.592,0,0,1-11.721,22.259c-5.634.165-11.276.061-16.914.059C1157.507,1025.128,1157.278,1025.1,1156.959,1025.088Zm8.3-48c2.221,0,4.444.038,6.663-.031a2.04,2.04,0,0,0,1.336-.667c.989-1.177,1.875-2.44,2.8-3.67,1.007-1.337.911-2.191-.411-3.256a3.232,3.232,0,0,0-3.758-.423c-1.693.859-3.422,1.649-5.091,2.55a2.9,2.9,0,0,1-3.019.02c-1.74-.936-3.521-1.8-5.318-2.626a3.346,3.346,0,0,0-4.394,1.433,1.472,1.472,0,0,0,.1,1.917c1.082,1.306,2.1,2.671,3.067,4.062a1.547,1.547,0,0,0,1.481.7C1160.9,977.067,1163.077,977.086,1165.259,977.086Zm-6.553,3.34v3.207h13.147v-3.207Z"
                  fill="#28292B"
                />
                <path
                  d="M1153.545,1039.988H1150.3v-34.643h-36.713v26.346h-3.37v-1.1q0-13.19,0-26.381c0-1.757.5-2.274,2.241-2.275q19.481-.006,38.96,0c1.557,0,2.173.556,2.174,2q.014,17.745,0,35.489C1153.6,1039.579,1153.569,1039.732,1153.545,1039.988Z"
                  fill="#28292B"
                />
                <path
                  d="M1120.229,1026.71c0-.911,0-1.734,0-2.557,0-.189.025-.377.044-.647h3.29v-1.326c0-3.308-.006-6.616,0-9.924,0-1.442.56-2.018,2-2.033q3.033-.033,6.068,0c1.343.017,1.923.625,1.94,1.988.019,1.491,0,2.982,0,4.631h3.235c3.354,0,3.439.085,3.439,3.465v3.127h3.248v3.275Zm9.928-3.3v-9.784h-3.19v9.784Zm3.471,0h3.214v-3.17h-3.214Z"
                  fill="#28292B"
                />
                <path
                  d="M1140.328,972.121l-5.092-1.738,1.064-3.175c3.262,1.1,6.45,2.162,9.62,3.272a1.41,1.41,0,0,1,.942,1.821c-1.01,3.179-2.1,6.332-3.184,9.573l-3.154-1,2.01-6.1a32.428,32.428,0,0,0-17.014,17.793l-3.083-1.174C1125.867,982.686,1131.8,976.425,1140.328,972.121Z"
                  fill="#28292B"
                />
                <path
                  d="M1166.639,1015.127h-3.079c.342-1.323-.282-1.96-1.362-2.589a4.261,4.261,0,0,1-1.928-3.91h3.273c.139,1.008.687,1.741,1.782,1.543a2.165,2.165,0,0,0,1.473-1.032,1.778,1.778,0,0,0-.681-1.521,25.118,25.118,0,0,0-3.137-1.669,4.615,4.615,0,0,1-.689-8.038c1.01-.676,1.577-1.277,1.266-2.535h3.41a2.173,2.173,0,0,0,1.342,2.587,4.23,4.23,0,0,1,1.956,3.9h-3.239c-.211-.993-.731-1.8-1.905-1.541a2.01,2.01,0,0,0-1.367,1.009,1.822,1.822,0,0,0,.659,1.538,17.723,17.723,0,0,0,2.821,1.5,4.762,4.762,0,0,1,3.017,4.315c.062,2.009-1.018,3.343-2.7,4.4C1167.056,1013.4,1166.965,1014.354,1166.639,1015.127Z"
                  fill="#28292B"
                />
                <path d="M1125.3,1031.8h19.872V1035H1125.3Z" fill="#28292B" />
                <path
                  d="M1173.449,1029.685a35.857,35.857,0,0,1-16.163,7.974c-.2-.916-.387-1.753-.56-2.594a5.029,5.029,0,0,1-.037-.676,31.924,31.924,0,0,0,14.525-7.187Z"
                  fill="#28292B"
                />
                <path
                  d="M1123.9,998.868l-3.266-.5.658-3.44,3.233.766Z"
                  fill="#28292B"
                />
                <path
                  d="M1173.679,1003.643h3.193v3.192h-3.193Z"
                  fill="#28292B"
                />
                <path d="M1118.623,1031.8h3.194V1035h-3.194Z" fill="#28292B" />
              </g>
            </svg>
            <p className="text-neutral-700 text-base md:text-lg">
              Sem cartão de crédito e sem burocracia.
            </p>
          </div>
        </div>
        <p className="text-center text-lg md:text-xl font-semibold mt-10">
          Então a Kars é pra você!
        </p>
        <p className="text-center text-neutral-600 mt-2 text-sm md:text-base">
          Não é necessário experiência prévia ou crédito para locar conosco.
        </p>
      </section>
      {/* COMO FUNCIONA */}
      <section
        id="como-funciona"
        className="py-16 md:py-24 bg-neutral-100 px-4 md:px-6"
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 md:mb-16">
          Como funciona
        </h2>
        <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 max-w-6xl mx-auto">
          {[
            "Cadastre-se na Kars e aguarde nosso contato.",
            "Receba um carro.",
            "Trabalhe melhor e ganhe mais.",
          ].map((step, index) => (
            <div
              key={index}
              className="text-center p-8 bg-white rounded-2xl shadow-md border"
            >
              <span className="text-3xl md:text-5xl font-bold text-yellow-500">
                {index + 1}
              </span>
              <p className="mt-4 text-neutral-700 text-base md:text-lg">
                {step}
              </p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10 md:mt-14">
          <a
            href="#parceiros"
            className="px-8 md:px-10 py-3.5 md:py-4 bg-neutral-900 text-white rounded-full shadow-xl hover:bg-neutral-800 transition-all text-base md:text-lg font-semibold"
          >
            ALUGUE CONOSCO →
          </a>
        </div>
      </section>
      {/* POR QUE A Kars */}
      <section id="por-que" className="py-16 md:py-24 px-4 md:px-6 bg-white">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 md:mb-16">
          Por que a KarzHub é a sua melhor escolha?
        </h2>
        <div className="max-w-5xl mx-auto">
          <table
            className="
    w-full border-collapse text-[11px] 
    sm:text-sm md:text-base 
    table-fixed
  "
          >
            <thead>
              <tr className="bg-white text-neutral-900 font-bold border-b">
                <th className="p-2 sm:p-3 md:p-5 w-[55%] text-left"></th>
                <th className="p-2 sm:p-3 md:p-5 text-center bg-yellow-50 w-[22%]">
                  KarzHub
                </th>
                <th className="p-2 sm:p-3 md:p-5 text-center w-[22%]">
                  Outras
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Modelos sedan 1.0", true, true],
                ["Manutenção preventiva sem custo", true, true],
                ["Pagamento semanal", true, true],
                ["Carros GNV (Gás natural veicular)", true, false],
                ["Programa de Fidelização", true, false],
                [
                  "Suporte Financeiro - Flexibilização no pagamento de multas, avarias, etc.",
                  true,
                  false,
                ],
                ["Carro reserva sem custo", true, false],
                ["Suporte Operacional 24/7", true, false],
                ["Monitoramento 24/7", true, false],
              ].map(([text, k, o], index) => (
                <tr
                  key={index}
                  className={`${
                    index % 2 === 0 ? "bg-neutral-100" : "bg-neutral-50"
                  }`}
                >
                  <td className="p-2 sm:p-3 md:p-5 align-middle leading-tight">
                    {text}
                  </td>
                  <td className="p-2 sm:p-3 md:p-5 bg-yellow-50 text-center align-middle">
                    {k && (
                      <span
                        className="
                inline-flex items-center justify-center 
                w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8
                rounded-full border-2 border-neutral-800 text-[10px] md:text-base
              "
                      >
                        ✓
                      </span>
                    )}
                  </td>
                  <td className="p-2 sm:p-3 md:p-5 text-center align-middle">
                    {o && (
                      <span
                        className="
                inline-flex items-center justify-center 
                w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8
                rounded-full border-2 border-neutral-800 text-[10px] md:text-base
              "
                      >
                        ✓
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center mt-10 md:mt-14">
          <a
            href="#parceiros"
            className="px-8 md:px-10 py-3.5 md:py-4 bg-yellow-500 text-black rounded-full shadow-xl hover:bg-yellow-600 transition-all text-base md:text-lg font-semibold"
          >
            ALUGUE CONOSCO →
          </a>
        </div>
      </section>
      {/* FORM PARCEIROS */}
      <section
        id="parceiros"
        className="py-16 md:py-24 max-w-3xl mx-auto px-4 md:px-6"
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-6 md:mb-10">
          FAÇA O SEU CADASTRO
        </h2>
        <p className="text-center text-neutral-600 mb-8 md:mb-10 text-sm md:text-base">
          Aproveite as vantagens de alugar com a Kars.
        </p>
        {ok ? (
          <div className="p-3 rounded-xl bg-green-100 text-green-700 text-sm text-center">
            Seu cadastro foi realizado com sucesso, fique de olho no seu e-mail
            e whatsapp para mais, detalhes. Acesse o link enviado para o seu
            e-mail e faca o login para acompanhar o status da sua locacao.
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="bg-white shadow-lg border border-neutral-200 rounded-2xl p-6 md:p-10 space-y-5 md:space-y-6"
          >
            <input
              placeholder="Nome Completo"
              className="w-full p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
            <input
              placeholder="CPF ou CNPJ"
              className="w-full p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
              value={form.cpf}
              onChange={(e) => set("cpf", e.target.value)}
              required
            />
            <div className="space-y-2">
              <label className="font-semibold text-sm md:text-base">
                Data de nascimento
              </label>
              <input
                placeholder="Data de Nascimento"
                type="date"
                className="w-full p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
                value={form.birthdate}
                onChange={(e) => set("birthdate", e.target.value)}
              />
            </div>
            <input
              placeholder="WhatsApp ou Celular"
              className="w-full p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="E-mail"
              className="w-full p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
            <input
              placeholder="Cidade"
              className="w-full p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
            <div>
              <label className="font-semibold text-sm md:text-base">
                Possui EAR?
              </label>
              <select
                className="w-full mt-2 p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
                value={form.ear}
                onChange={(e) => set("ear", e.target.value)}
              >
                <option>Sim</option>
                <option>N o</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-sm md:text-base">
                Cadastrado na Uber?
              </label>
              <select
                className="w-full mt-2 p-3.5 md:p-4 rounded-xl bg-neutral-100 border border-neutral-300"
                value={form.uber}
                onChange={(e) => set("uber", e.target.value)}
              >
                <option>Sim</option>
                <option>N o</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3.5 md:py-4 rounded-xl shadow-lg text-base md:text-lg transition disabled:opacity-70"
            >
              {loading ? "Enviando..." : "ENVIAR O SEU CADASTRO"}
            </button>
          </form>
        )}
        {/* O que   EAR */}
        <div className="mt-10 md:mt-16 p-6 md:p-8 bg-neutral-100 rounded-xl border shadow">
          <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">
            O que EAR?
          </h3>
          <p className="text-neutral-700 leading-relaxed text-sm md:text-base">
            Para exercer atividade remunerada com o ve culo, preciso a inclus o
            da observa o <strong>Exerce Atividade Remunerada (EAR)</strong> na
            sua CNH.
          </p>
        </div>
      </section>
      {showConfirm && !ok && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-xl font-semibold text-neutral-900">
              Confirmar envio
            </h3>
            <p className="text-neutral-700 text-sm">
              Confira suas informacoes antes de enviar.
            </p>
            <div className="bg-neutral-50 border rounded-xl p-4 space-y-2 text-sm text-neutral-800">
              <p>
                <strong>Nome:</strong> {form.name || "-"}
              </p>
              <p>
                <strong>CPF/CNPJ:</strong> {form.cpf || "-"}
              </p>
              <p>
                <strong>Nascimento:</strong> {form.birthdate || "-"}
              </p>
              <p>
                <strong>Telefone:</strong> {form.phone || "-"}
              </p>
              <p>
                <strong>E-mail:</strong> {form.email || "-"}
              </p>
              <p>
                <strong>Cidade:</strong> {form.city || "-"}
              </p>
              <p>
                <strong>EAR:</strong> {form.ear}
              </p>
              <p>
                <strong>Uber:</strong> {form.uber}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border text-neutral-700 hover:bg-neutral-100 transition"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Revisar
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-600 transition disabled:opacity-70"
              >
                {loading ? "Enviando..." : "Confirmar envio"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* WHATSAPP FLUTUANTE */}
      <a
        href="https://wa.me/5511000000000"
        target="_blank"
        rel="noopener noreferrer"
        className="
    fixed bottom-5 right-5 sm:bottom-6 sm:right-6
    bg-[#25D366] hover:bg-[#1ebe5d]
    text-white rounded-full cursor-pointer
    w-16 h-16 sm:w-20 sm:h-20
    flex items-center justify-center
    shadow-xl hover:shadow-2xl
    transition-all duration-300
    animate-pulse-soft
    z-50
  "
        aria-label="WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="#ffffff"
          width="40"
          height="40"
          viewBox="0 0 32 32"
          version="1.1"
        >
          <title>whatsapp</title>
          <path d="M26.576 5.363c-2.69-2.69-6.406-4.354-10.511-4.354-8.209 0-14.865 6.655-14.865 14.865 0 2.732 0.737 5.291 2.022 7.491l-0.038-0.070-2.109 7.702 7.879-2.067c2.051 1.139 4.498 1.809 7.102 1.809h0.006c8.209-0.003 14.862-6.659 14.862-14.868 0-4.103-1.662-7.817-4.349-10.507l0 0zM16.062 28.228h-0.005c-0 0-0.001 0-0.001 0-2.319 0-4.489-0.64-6.342-1.753l0.056 0.031-0.451-0.267-4.675 1.227 1.247-4.559-0.294-0.467c-1.185-1.862-1.889-4.131-1.889-6.565 0-6.822 5.531-12.353 12.353-12.353s12.353 5.531 12.353 12.353c0 6.822-5.53 12.353-12.353 12.353h-0zM22.838 18.977c-0.371-0.186-2.197-1.083-2.537-1.208-0.341-0.124-0.589-0.185-0.837 0.187-0.246 0.371-0.958 1.207-1.175 1.455-0.216 0.249-0.434 0.279-0.805 0.094-1.15-0.466-2.138-1.087-2.997-1.852l0.010 0.009c-0.799-0.74-1.484-1.587-2.037-2.521l-0.028-0.052c-0.216-0.371-0.023-0.572 0.162-0.757 0.167-0.166 0.372-0.434 0.557-0.65 0.146-0.179 0.271-0.384 0.366-0.604l0.006-0.017c0.043-0.087 0.068-0.188 0.068-0.296 0-0.131-0.037-0.253-0.101-0.357l0.002 0.003c-0.094-0.186-0.836-2.014-1.145-2.758-0.302-0.724-0.609-0.625-0.836-0.637-0.216-0.010-0.464-0.012-0.712-0.012-0.395 0.010-0.746 0.188-0.988 0.463l-0.001 0.002c-0.802 0.761-1.3 1.834-1.3 3.023 0 0.026 0 0.053 0.001 0.079l-0-0.004c0.131 1.467 0.681 2.784 1.527 3.857l-0.012-0.015c1.604 2.379 3.742 4.282 6.251 5.564l0.094 0.043c0.548 0.248 1.25 0.513 1.968 0.74l0.149 0.041c0.442 0.14 0.951 0.221 1.479 0.221 0.303 0 0.601-0.027 0.889-0.078l-0.031 0.004c1.069-0.223 1.956-0.868 2.497-1.749l0.009-0.017c0.165-0.366 0.261-0.793 0.261-1.242 0-0.185-0.016-0.366-0.047-0.542l0.003 0.019c-0.092-0.155-0.34-0.247-0.712-0.434z" />
        </svg>
      </a>
      {/* FOOTER */}
      <footer className="bg-neutral-900 text-neutral-400 py-8 md:py-10 text-center mt-10 md:mt-20 px-4">
        <p className="text-sm md:text-base">
          © {new Date().getFullYear()} Kars - Locação de Veículos
        </p>
        <p className="text-xs md:text-sm mt-1">Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}
