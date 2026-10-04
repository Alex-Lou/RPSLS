import { PAD_META } from "../../types";
import type { PadId } from "../../types";

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Nom localisé d'un tapis : clé `pad.<id>` si elle existe, sinon le libellé
 *  du catalogue (PAD_META, noms propres). `t` renvoie la clé quand elle manque. */
export function padLabel(t: TFn, id: PadId): string {
  const k = `pad.${id}`;
  const v = t(k);
  return v === k ? PAD_META[id].label : v;
}

/** Accroche localisée d'un tapis : clé `pad.<id>.tag`, sinon PAD_META (dont
 *  les accroches mélangeaient anglais et français). */
export function padTagline(t: TFn, id: PadId): string {
  const k = `pad.${id}.tag`;
  const v = t(k);
  return v === k ? PAD_META[id].tagline : v;
}

/** Nom localisé d'un fond : « Mon image » pour le fond importé, clé `profile.bg.<id>`
 *  si elle existe, sinon le libellé du catalogue (noms propres des sets). */
export function bgLabel(t: TFn, bg: { id: string; label: string; custom?: boolean }): string {
  if (bg.custom) return t("profile.style.myImage");
  const k = `profile.bg.${bg.id}`;
  const v = t(k);
  return v === k ? bg.label : v;
}
