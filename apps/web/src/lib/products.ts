import type { Product } from "./types";

// The catalogue. A product is an entry here plus its photography in
// `public/products/`. Variant ids must stay stable — carts store them.
const SIZES = ["M", "L", "XL", "XXL"];

function sized(slug: string, price: number) {
  return SIZES.map((label) => ({
    id: `${slug}-${label.toLowerCase()}`,
    label,
    price,
  }));
}

function single(slug: string, price: number, label = "One Size") {
  return [
    {
      id: `${slug}-${label.toLowerCase().replace(/\s+/g, "-")}`,
      label,
      price,
    },
  ];
}

export const PRODUCTS: Product[] = [
  {
    slug: "tshirt-black",
    name: "Godacity Tee — Black",
    description:
      "Heavyweight black tee. GODACITY across the chest, THE GODACIOUS ONES across the back.",
    category: "tshirts",
    fromPrice: 9000,
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
    description:
      "White tee with a small chest hit. GODS IN THE CITY across the back.",
    category: "tshirts",
    fromPrice: 9000,
    variants: sized("tshirt-white", 9000),
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
    fromPrice: 17000,
    soldOut: true,
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
    fromPrice: 7000,
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
    fromPrice: 7000,
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
    description:
      "Six-panel cap with the GODACITY logo and Unbound crest on the front.",
    category: "caps",
    fromPrice: 5000,
    variants: [
      { id: "cap-black", label: "Black", price: 5000 },
      { id: "cap-purple", label: "Purple", price: 5000 },
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
    fromPrice: 5000,
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
    fromPrice: 5000,
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
    fromPrice: 5000,
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
