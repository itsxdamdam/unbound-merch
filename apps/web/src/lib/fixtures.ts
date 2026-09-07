import type { Product } from "./types";

/**
 * Placeholder catalogue, used ONLY when NEXT_PUBLIC_API_URL is unset.
 *
 * The backend does not exist yet, and a storefront that cannot render a
 * product is a storefront nobody can work on. This keeps the shop, the
 * gallery, the hover flip and the cart developable until there is an API to
 * point at. It is not a cache and not a fallback for an API that is merely
 * down — `catalog.ts` uses it only when no backend is configured at all.
 *
 * Delete this file once the backend is live; nothing else imports it directly.
 */
const SIZES = ["M", "L", "XL", "XXL"];

function sized(slug: string, priceNaira: number) {
  return SIZES.map((label) => ({
    id: `${slug}-${label.toLowerCase()}`,
    label,
    priceKobo: String(priceNaira * 100),
    available: 20,
  }));
}

function single(slug: string, priceNaira: number, label = "One Size") {
  return [
    {
      id: `${slug}-${label.toLowerCase().replace(/\s+/g, "-")}`,
      label,
      priceKobo: String(priceNaira * 100),
      available: 20,
    },
  ];
}

export const FIXTURE_PRODUCTS: Product[] = [
  {
    slug: "tshirt-black",
    name: "Godacity Tee — Black",
    description:
      "Heavyweight black tee. GODACITY across the chest, THE GODACIOUS ONES across the back.",
    category: "tshirts",
    fromKobo: "900000",
    variants: sized("tshirt-black", 9000),
    images: [
      {
        url: "/products/tshirts/tshirt-black-front-godacity.png",
        alt: "Front of a black t-shirt with the GODACITY logo in white across the chest.",
        variantId: null,
      },
      {
        url: "/products/tshirts/tshirt-black-back-the-godacious-ones.png",
        alt: "Back of the black t-shirt reading THE GODACIOUS ONES in white inside a yellow box.",
        variantId: null,
      },
    ],
  },
  {
    slug: "tshirt-white",
    name: "Godacity Tee — White",
    description: "White tee with a small chest hit. GODS IN THE CITY across the back.",
    category: "tshirts",
    fromKobo: "850000",
    variants: sized("tshirt-white", 8500),
    images: [
      {
        url: "/products/tshirts/tshirt-white-front.png",
        alt: "Front of a white t-shirt with a small red Unbound crest and a black GODACITY logo.",
        variantId: null,
      },
      {
        url: "/products/tshirts/tshirt-white-back-gods-in-the-city.png",
        alt: "Back of the white t-shirt reading GODS IN THE CITY.",
        variantId: null,
      },
    ],
  },
  {
    slug: "jersey",
    name: "Godacity Jersey",
    description:
      "Purple and red football jersey with lightning-bolt shoulders and a GODACITY chest print.",
    category: "jerseys",
    fromKobo: "1700000",
    variants: sized("jersey", 17000),
    images: [
      {
        url: "/products/jerseys/jersey-front.png",
        alt: "Front of a purple and red football jersey with yellow lightning bolts and GODACITY across the chest.",
        variantId: null,
      },
      {
        url: "/products/jerseys/jersey-back.png",
        alt: "Back of the purple and red Godacity football jersey.",
        variantId: null,
      },
    ],
  },
  {
    slug: "scarf-cityscape-blue",
    name: "Cityscape Scarf — Blue",
    description:
      "Square print scarf. Brightly coloured skyscrapers seen from below, GODACITY at the centre.",
    category: "scarves",
    fromKobo: "700000",
    variants: single("scarf-cityscape-blue", 7000),
    images: [
      {
        url: "/products/scarves/scarf-cityscape-blue.png",
        alt: "Square scarf: brightly coloured skyscrapers seen from below against a pale blue sky, with GODACITY at the centre.",
        variantId: null,
      },
    ],
  },
  {
    slug: "scarf-geometric-purple",
    name: "Geometric Scarf — Purple",
    description:
      "Square print scarf. Bold purple, orange and yellow geometry with GODACITY across the middle.",
    category: "scarves",
    fromKobo: "700000",
    variants: single("scarf-geometric-purple", 7000),
    images: [
      {
        url: "/products/scarves/scarf-geometric-purple.png",
        alt: "Square scarf: bold purple, orange and yellow geometric shapes with GODACITY across the middle.",
        variantId: null,
      },
    ],
  },
  {
    slug: "cap",
    name: "Godacity Cap",
    description: "Six-panel cap with the GODACITY logo and Unbound crest on the front.",
    category: "caps",
    fromKobo: "500000",
    variants: [
      { id: "cap-black", label: "Black", priceKobo: "500000", available: 20 },
      { id: "cap-purple", label: "Purple", priceKobo: "500000", available: 20 },
    ],
    images: [
      {
        url: "/products/caps/cap-black-godacity.png",
        alt: "Black baseball cap with the Unbound crest and GODACITY logo in white on the front panel.",
        variantId: "cap-black",
      },
      {
        url: "/products/caps/cap-purple-godacity.png",
        alt: "Purple baseball cap with the Unbound crest and GODACITY logo in white on the front panel.",
        variantId: "cap-purple",
      },
    ],
  },
  {
    slug: "tote-black",
    name: "Godacity Tote — Black",
    description: "Black cotton tote with the GODACITY logo.",
    category: "tote-bags",
    fromKobo: "500000",
    variants: single("tote-black", 5000),
    images: [
      {
        url: "/products/tote-bags/totebag-black-godacity.png",
        alt: "Black cotton tote bag with the GODACITY logo.",
        variantId: null,
      },
    ],
  },
  {
    slug: "tote-green",
    name: "The Godacious Ones Tote — Green",
    description: "Green cotton tote carrying THE GODACIOUS ONES artwork.",
    category: "tote-bags",
    fromKobo: "500000",
    variants: single("tote-green", 5000),
    images: [
      {
        url: "/products/tote-bags/totebag-green-the-godacious-ones.png",
        alt: "Green cotton tote bag with THE GODACIOUS ONES artwork.",
        variantId: null,
      },
    ],
  },
  {
    slug: "tote-red",
    name: "Godacity Tote — Red",
    description: "Red cotton tote with the GODACITY logo.",
    category: "tote-bags",
    fromKobo: "500000",
    variants: single("tote-red", 5000),
    images: [
      {
        url: "/products/tote-bags/totebag-red-godacity.png",
        alt: "Red cotton tote bag with the GODACITY logo.",
        variantId: null,
      },
    ],
  },
];
