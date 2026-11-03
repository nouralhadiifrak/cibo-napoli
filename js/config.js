/* Cibo Napoli: restaurant details used across the site and the staff app. */
window.CONFIG = {
  name: "Cibo Napoli",
  tagline: "La Buona Cucina Napolitana",
  // Public address of the site (canonical links, sitemap, share previews). Demo address until the domain is bought.
  siteUrl: "https://cibo-napoli.vercel.app",
  // The restaurants. With one, there is no restaurant picker; add another object here to get it (see README).
  locations: [
    {
      id: "el-mansouria",
      // Name as on the Google Business Profile.
      googleName: "Cibo Napoli",
      name: { fr: "Cibo Napoli", en: "Cibo Napoli" },
      short: { fr: "El Mansouria", en: "El Mansouria" },
      // DEMO: the test number for everything until the owner's number is confirmed.
      phone: "0634235350",
      phoneIntl: "+212634235350",
      // WhatsApp in international format, digits only.
      whatsapp: "212634235350",
      instagram: "https://www.instagram.com/cibo_napoli/",
      instagramHandle: "@cibo_napoli",
      googleMapsUrl: "https://maps.app.goo.gl/SZC2hhTLup2dU2f38",
      // Google Place ID (from the Maps link), used for the review link.
      placeId: "ChIJWcsRBQCxpw0RGfvunC8altw",
      // TODO: the street address once the Google profile is fixed.
      address: { fr: "El Mansouria", en: "El Mansouria" },
      streetAddress: "",
      locality: "El Mansouria",
      postalCode: "",
      // The pin of the Google listing: the map and the delivery distance are measured from here.
      location: { lat: 33.7372332, lng: -7.3142341 },
    },
  ],
  // Every day, 24 h format, Casablanca time. "00:00" as closing time means midnight.
  hours: { open: "12:00", close: "00:00" },
  timeZone: "Africa/Casablanca",
  currency: "DH",
  // Delivery: inside the zone drawn by the owner (El Mansouria along the coast, plus the east of Mohammedia) and
  // never more than maxKm (straight line) from the restaurant; one flat fee (DH). zone = [lat, lng] corners.
  delivery: {
    maxKm: 8,
    fee: 10,
    zone: [
      [33.71425, -7.35303], [33.71882, -7.35166], [33.72024, -7.34651], [33.72096, -7.34307],
      [33.72453, -7.34479], [33.7281, -7.34685], [33.73095, -7.34565], [33.73238, -7.34136],
      [33.73381, -7.33707], [33.73666, -7.33449], [33.73809, -7.3302], [33.74023, -7.32591],
      [33.74166, -7.32162], [33.74451, -7.31732], [33.74665, -7.31303], [33.74951, -7.3096],
      [33.75236, -7.30702], [33.75379, -7.30273], [33.75736, -7.30102], [33.75879, -7.29844],
      [33.76021, -7.29501], [33.76235, -7.29157], [33.76521, -7.28814], [33.76521, -7.28471],
      [33.76164, -7.27956], [33.75879, -7.27613], [33.7545, -7.27355], [33.75022, -7.27183],
      [33.74523, -7.27012], [33.74309, -7.27441], [33.74023, -7.27956], [33.73666, -7.28471],
      [33.73309, -7.28986], [33.73024, -7.29501], [33.72596, -7.30187], [33.72167, -7.30874],
      [33.71739, -7.31561], [33.7131, -7.32076], [33.705, -7.33485], [33.69786, -7.34858],
      [33.69286, -7.36232], [33.69358, -7.37433], [33.69786, -7.38292], [33.70358, -7.38549],
      [33.709, -7.38377], [33.70957, -7.37691], [33.71015, -7.36918], [33.71157, -7.3606],
    ],
  },
  // Table bookings (/reserver/): half-hour slots from first to last, up to maxPeople per booking, up to maxDays ahead.
  booking: { first: "12:00", last: "23:00", maxPeople: 20, maxDays: 60 },
  // How the customer pays.
  payment: { delivery: ["cash"], pickup: ["cash", "card"] },
  // Hero picture: the pizza on its white plate, cut out (transparent around the plate) so the warm light under it
  // shows on the dark background. It turns slowly; spin: false stops it.
  // A video also works: { video: "/assets/hero/hero.mp4", poster: "/assets/hero/hero.webp" }. null = the drawn pizza.
  heroMedia: { image: "/assets/hero/pizza-plate.webp", small: "/assets/hero/pizza-plate-480.webp", spin: true },
  // Home page, « La collection signature »: 4 dish ids from js/menu-data.js (name, text and price come from there).
  // Their photo is the dish's own image in menu-data.js; until then a drawn placeholder with « Photo à venir ».
  signature: ["pizza-cibo-napoli", "truffe-mafia", "ravioli-al-truffo", "lasagne-nonna"],
  // Home page, « Notre histoire »: the 3 photos (e.g. "/assets/home/team.webp", about 1200 px wide, WebP).
  // Empty = a placeholder that says which photo goes there.
  homePhotos: { team: "", plate: "", outside: "" },
  // Online orders and table bookings: the Supabase project « cibo napoli » (EU, Ireland), schema in
  // supabase/schema.sql. The publishable key is public by design: row level security decides what it can do.
  // (Empty supabaseUrl = DEMO MODE: orders stay in the browser; the tests use it.)
  orders: {
    supabaseUrl: "https://tucvrdecsmdfeacvdkdt.supabase.co",
    publishableKey: "sb_publishable_KUr-QTxbNq3TPyW_kEg8kA_ChIs8X_Y",
    // TEMPORARY, for showing the owner: orders can be sent at any hour, even when the restaurant is closed (the
    // site still shows the real hours). Set back to false before real use.
    alwaysOpen: true,
    // After this many minutes without an answer, the customer is offered WhatsApp.
    callAfterMinutes: 5,
    // Public half of the push notification keys (the private half stays in the database, never in this repo).
    vapidPublicKey: "",
  },
  // Share preview (WhatsApp, Facebook), 1200 x 630.
  shareImage: "/assets/share.jpg",
};
