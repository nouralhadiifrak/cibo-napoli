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
  // Delivery: anywhere within maxKm (straight line) of the restaurant, one flat fee (DH).
  delivery: { maxKm: 4, fee: 10 },
  // How the customer pays.
  payment: { delivery: ["cash"], pickup: ["cash", "card"] },
  // Hero picture or video, once the owner sends one. null = the drawn pizza.
  // e.g. { image: "/assets/hero/hero.webp" } or { video: "/assets/hero/hero.mp4", poster: "/assets/hero/hero.webp" }
  heroMedia: null,
  // Online orders.
  //  - supabaseUrl empty = DEMO MODE: orders stay in this browser (localStorage). Open /commandes/ in another tab of
  //    the same browser to play the restaurant. Nothing leaves the phone.
  //  - with supabaseUrl and publishableKey (public by design; row level security decides what it can do, see
  //    supabase/schema.sql), orders go to the real staff screen.
  orders: {
    supabaseUrl: "",
    publishableKey: "",
    // After this many minutes without an answer, the customer is offered WhatsApp.
    callAfterMinutes: 5,
    // Public half of the push notification keys (the private half stays in the database, never in this repo).
    vapidPublicKey: "",
  },
  // Share preview (WhatsApp, Facebook), 1200 x 630.
  shareImage: "/assets/share.jpg",
};
