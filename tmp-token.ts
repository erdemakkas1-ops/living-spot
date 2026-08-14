import { tokenUret } from "./src/lib/saha-token.server";
const { supabaseAdmin } = await import("./src/integrations/supabase/client.server");
const { data } = await supabaseAdmin.from("personel").select("id, ad_soyad, oturum_surumu").eq("rol","personel").eq("aktif",true).limit(1).maybeSingle();
console.log(JSON.stringify(data));
console.log(await tokenUret(data!.id, "personel", data!.oturum_surumu));
