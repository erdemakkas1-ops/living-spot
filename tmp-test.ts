import { konumIzniGetirSunucu, konumIzniGuncelleSunucu } from "./src/lib/saha-server.server";
const t = process.argv[2];
console.log("başlangıç:", await konumIzniGetirSunucu(t));
console.log("onay:", await konumIzniGuncelleSunucu(t, true), "->", await konumIzniGetirSunucu(t));
console.log("geri çek:", await konumIzniGuncelleSunucu(t, false), "->", await konumIzniGetirSunucu(t));
const { supabaseAdmin } = await import("./src/integrations/supabase/client.server");
console.log(JSON.stringify((await supabaseAdmin.from("konum_izinleri").select("*")).data));
