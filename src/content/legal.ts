import type { Locale } from "@/i18n/config";

/**
 * The privacy notice and terms of use, in plain language. They describe what the app actually does: keep them true
 * when it changes (what's collected, which services hold it, how it's protected), and update `UPDATED` with them.
 */

export const LEGAL_CONTACT = "jorgecarlosquevedo@gmail.com";
export const LEGAL_UPDATED = "2026-10-15";

export type LegalSection = { heading: string; paragraphs?: string[]; items?: string[] };
export type LegalDocument = { title: string; intro: string; sections: LegalSection[] };

const privacy: Record<Locale, LegalDocument> = {
  es: {
    title: "Aviso de privacidad",
    intro: "Tu información financiera es tuya. Aquí te explicamos, sin letra chiquita, qué datos guarda Yield, para qué y cómo los cuidamos.",
    sections: [
      {
        heading: "Quién es responsable",
        paragraphs: [
          `Jorge Carlos Quevedo (YIELD Financial), en Tijuana, Baja California, México, es el responsable de tus datos personales. Para cualquier duda o solicitud sobre ellos, escribe a ${LEGAL_CONTACT}.`,
        ],
      },
      {
        heading: "Qué datos guardamos",
        items: [
          "De tu cuenta de Google: tu nombre, correo y foto de perfil, solo para identificarte al iniciar sesión. No tenemos acceso a tu correo, tus archivos ni nada más de tu cuenta de Google.",
          "Lo que registras en la app: gastos, ingresos, pagos recurrentes, tarjetas, dinero disponible, ahorros, estimados, notas y los nombres que les pones. Son datos financieros: al crear tu cuenta y registrarlos nos das tu consentimiento expreso para tratarlos con los fines de este aviso.",
          "Datos técnicos mínimos: una cookie para mantener tu sesión y otra para recordar tu idioma. Si activas los recordatorios, la suscripción de notificaciones de tu navegador.",
        ],
      },
      {
        heading: "Para qué los usamos",
        paragraphs: [
          "Solo para que la app funcione: mostrarte tus cifras, tu pronóstico y tus recordatorios. No vendemos, rentamos ni compartimos tus datos con nadie para sus propios fines, no mostramos anuncios y no usamos herramientas de analítica ni de rastreo.",
        ],
      },
      {
        heading: "Cómo los protegemos",
        paragraphs: [
          "Las cantidades, nombres y notas que registras se guardan cifrados en la base de datos, y toda la comunicación con la app viaja cifrada (HTTPS).",
          "Para ser honestos: la llave de cifrado vive en nuestros servidores, así que quien opera la app técnicamente podría descifrar tu información. No lo hacemos. Solo lo haríamos para resolver un problema técnico que tú nos pidas, o si una autoridad lo exige conforme a la ley.",
        ],
      },
      {
        heading: "Quién más interviene",
        paragraphs: ["Para operar la app usamos estos proveedores, que tratan los datos solo por nuestra cuenta:"],
        items: [
          "Vercel (hospedaje de la app) y Prisma (base de datos). Sus servidores pueden estar fuera de México, principalmente en Estados Unidos.",
          "Google, para iniciar sesión.",
          "Frankfurter, para el tipo de cambio del día si tienes dinero en otras monedas. Solo le enviamos los códigos de las monedas (por ejemplo, USD y MXN), nunca tus cantidades ni nada sobre ti.",
          "El servicio de notificaciones de tu navegador (de Google, Apple o Mozilla), solo si activas los recordatorios.",
        ],
      },
      {
        heading: "Tus derechos",
        paragraphs: [
          "Puedes acceder a tus datos, corregirlos, cancelarlos u oponerte a su uso (derechos ARCO), y revocar tu consentimiento. Casi todo lo puedes hacer tú desde la app: ver y editar tus registros, borrarlos, o eliminar tu cuenta completa en Ajustes. Para cualquier otra solicitud, escribe a " + LEGAL_CONTACT + "; te respondemos en un máximo de 20 días hábiles.",
        ],
      },
      {
        heading: "Cuánto tiempo los guardamos",
        paragraphs: [
          "Mientras tengas tu cuenta. Si la eliminas, borramos todo de inmediato y para siempre; las copias de respaldo de nuestros proveedores pueden conservarlo un tiempo corto hasta que se reemplazan.",
        ],
      },
      {
        heading: "Menores de edad",
        paragraphs: ["Yield no está dirigida a menores de 18 años."],
      },
      {
        heading: "Cambios a este aviso",
        paragraphs: ["Si cambia, lo publicaremos aquí con su fecha. Si el cambio es importante, te avisaremos dentro de la app."],
      },
    ],
  },
  en: {
    title: "Privacy notice",
    intro: "Your financial information is yours. Here's what Yield keeps, why, and how we look after it, with no fine print.",
    sections: [
      {
        heading: "Who's responsible",
        paragraphs: [
          `Jorge Carlos Quevedo (YIELD Financial), in Tijuana, Baja California, Mexico, is responsible for your personal data. For any question or request about it, write to ${LEGAL_CONTACT}.`,
        ],
      },
      {
        heading: "What we keep",
        items: [
          "From your Google account: your name, email and profile photo, only to identify you when you sign in. We have no access to your email, your files, or anything else in your Google account.",
          "What you record in the app: spending, income, recurring payments, cards, money on hand, savings, estimates, notes, and the names you give them. This is financial data: by creating your account and recording it, you give your express consent for us to handle it for the purposes in this notice.",
          "Minimal technical data: one cookie to keep you signed in and another to remember your language. If you turn on reminders, your browser's notification subscription.",
        ],
      },
      {
        heading: "What we use it for",
        paragraphs: [
          "Only to make the app work: showing you your figures, your forecast and your reminders. We don't sell, rent or share your data with anyone for their own purposes, we show no ads, and we use no analytics or tracking tools.",
        ],
      },
      {
        heading: "How we protect it",
        paragraphs: [
          "The amounts, names and notes you record are stored encrypted in the database, and everything between you and the app travels encrypted (HTTPS).",
          "To be straight with you: the encryption key lives on our servers, so whoever runs the app could technically decrypt your information. We don't. We'd only do it to fix a technical problem you ask us to look at, or if an authority legally requires it.",
        ],
      },
      {
        heading: "Who else is involved",
        paragraphs: ["To run the app we use these providers, which handle data only on our behalf:"],
        items: [
          "Vercel (hosting the app) and Prisma (the database). Their servers may be outside Mexico, mainly in the United States.",
          "Google, to sign in.",
          "Frankfurter, for the day's exchange rates if you have money in other currencies. We only send it the currency codes (like USD and MXN), never your amounts or anything about you.",
          "Your browser's notification service (from Google, Apple or Mozilla), only if you turn on reminders.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can access your data, correct it, delete it or object to its use (your ARCO rights under Mexican law), and withdraw your consent. You can do almost all of it yourself in the app: see and edit your records, delete them, or delete your whole account in Settings. For anything else, write to " + LEGAL_CONTACT + "; we'll reply within 20 business days.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "For as long as you have your account. If you delete it, we erase everything right away and for good; our providers' backups may keep it for a short time until they're replaced.",
        ],
      },
      {
        heading: "Minors",
        paragraphs: ["Yield isn't meant for anyone under 18."],
      },
      {
        heading: "Changes to this notice",
        paragraphs: ["If it changes, we'll post it here with its date. If the change matters, we'll tell you in the app."],
      },
    ],
  },
};

const terms: Record<Locale, LegalDocument> = {
  es: {
    title: "Términos de uso",
    intro: "Las reglas del juego, cortas y claras. Al usar Yield aceptas estos términos.",
    sections: [
      {
        heading: "Qué es Yield",
        paragraphs: ["Una herramienta para registrar y entender tus finanzas personales. Por ahora es gratis. La ofrece Jorge Carlos Quevedo (YIELD Financial), en Tijuana, Baja California, México."],
      },
      {
        heading: "Tu cuenta",
        paragraphs: ["Inicias sesión con tu cuenta de Google. Eres responsable de lo que pase en tu cuenta y de que lo que registras sea correcto."],
      },
      {
        heading: "No es asesoría financiera",
        paragraphs: [
          "Las cifras, proyecciones, pronósticos y estimados de Yield son aproximaciones calculadas con lo que tú registras. Te ayudan a darte una idea, pero no son asesoría financiera, fiscal ni de inversión. Las decisiones sobre tu dinero son tuyas.",
        ],
      },
      {
        heading: "Uso aceptable",
        paragraphs: ["No uses Yield para nada ilegal, no intentes entrar a cuentas de otras personas y no intentes sobrecargar, vulnerar o copiar el servicio."],
      },
      {
        heading: "El servicio, tal cual",
        paragraphs: [
          "Hacemos lo posible porque Yield funcione bien, pero se ofrece tal cual: puede tener errores, cambiar o dejar de estar disponible. Si algún día cerramos, te avisaremos con tiempo razonable para que puedas revisar tu información.",
        ],
      },
      {
        heading: "Responsabilidad",
        paragraphs: [
          "En la medida en que la ley lo permita, no somos responsables por pérdidas o daños derivados del uso de la app, de errores en sus cifras o de decisiones tomadas con base en ellas.",
        ],
      },
      {
        heading: "Terminar",
        paragraphs: ["Puedes eliminar tu cuenta cuando quieras desde Ajustes. Podemos suspender cuentas que no respeten estos términos."],
      },
      {
        heading: "Cambios y ley aplicable",
        paragraphs: [
          "Si estos términos cambian, publicaremos la nueva versión aquí, y si el cambio es importante te avisaremos en la app. Se rigen por las leyes de México; cualquier controversia se resolverá ante los tribunales de Tijuana, Baja California.",
          `¿Dudas? Escribe a ${LEGAL_CONTACT}.`,
        ],
      },
    ],
  },
  en: {
    title: "Terms of use",
    intro: "The ground rules, short and clear. By using Yield you agree to these terms.",
    sections: [
      {
        heading: "What Yield is",
        paragraphs: ["A tool to record and understand your personal finances. For now it's free. It's offered by Jorge Carlos Quevedo (YIELD Financial), in Tijuana, Baja California, Mexico."],
      },
      {
        heading: "Your account",
        paragraphs: ["You sign in with your Google account. You're responsible for what happens in your account and for the accuracy of what you record."],
      },
      {
        heading: "Not financial advice",
        paragraphs: [
          "Yield's figures, projections, forecasts and estimates are approximations worked out from what you record. They help you get a sense of things, but they're not financial, tax or investment advice. Decisions about your money are yours.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: ["Don't use Yield for anything illegal, don't try to get into other people's accounts, and don't try to overload, break into or copy the service."],
      },
      {
        heading: "The service, as is",
        paragraphs: [
          "We do our best for Yield to work well, but it's offered as is: it may have errors, change, or stop being available. If we ever shut it down, we'll give you reasonable notice so you can review your information.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "To the extent the law allows, we're not liable for losses or damages arising from using the app, from errors in its figures, or from decisions made based on them.",
        ],
      },
      {
        heading: "Ending",
        paragraphs: ["You can delete your account whenever you want in Settings. We may suspend accounts that don't respect these terms."],
      },
      {
        heading: "Changes and governing law",
        paragraphs: [
          "If these terms change, we'll post the new version here, and if the change matters we'll tell you in the app. They're governed by the laws of Mexico; any dispute will be settled before the courts of Tijuana, Baja California.",
          `Questions? Write to ${LEGAL_CONTACT}.`,
        ],
      },
    ],
  },
};

export function legalDocument(kind: "privacy" | "terms", locale: Locale) {
  return (kind === "privacy" ? privacy : terms)[locale];
}
