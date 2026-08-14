import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { oturumKullanicisiGetirSunucu } from "./saha-server.server";

const OTURUM_COOKIE = "saha-oturum-token";

export const oturumKullanicisiGetirFn = createServerFn({ method: "POST" }).handler(() =>
  oturumKullanicisiGetirSunucu(getCookie(OTURUM_COOKIE) ?? ""),
);
