import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    // Server function errors must cross the RPC boundary as errors. Returning
    // an HTML Response here breaks TanStack serialization and hides the real
    // message behind a generic full-page failure on some devices.
    throw error;
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Bu uygulama Supabase Auth kullanmıyor; oturumlar PIN + imzalı HMAC token ile
// yürütülüyor. attachSupabaseAuth EKLENMEYECEK: tarayıcıdaki eski/saat kaymalı
// Supabase oturumu "JWT issued at future" hatasıyla tüm serverFn çağrılarını
// kırıyor.
export const startInstance = createStart(() => ({
  functionMiddleware: [],
  // yürütülüyor. attachSupabaseAuth kaldırıldı: tarayıcıdaki eski/saat kaymalı
  // Supabase oturumu "JWT issued at future" hatasıyla tüm serverFn çağrılarını
  // kırıyordu. Tekrar eklemeyin.
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
