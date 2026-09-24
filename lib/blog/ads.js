// The two ad slots shown on the blog. "house" is always ProVisuell's own ad;
// "partner" is reserved for a suggested partner company.
//
// Text fields take either an i18n key ({ t: "blog.…" }, translated per
// visitor) or a plain string (for a partner's own copy, which usually comes
// in one language). An `href` starting with "http" opens in a new tab and is
// marked rel="sponsored", as search engines require for paid links.
//
// To place a partner ad, replace PARTNER_AD with something like:
//   {
//     advertiser: "Acme AS",
//     title: "Acme — rental cars in Oslo",
//     text: "10% off your first rental with the code PROVISUELL.",
//     cta: "Visit Acme",
//     href: "https://acme.no",
//     image: "/assets/partners/acme.jpg",
//   }

const HOUSE_AD = {
  advertiser: "ProVisuell",
  title: { t: "blog.adHouseTitle" },
  text: { t: "blog.adHouseText" },
  cta: { t: "blog.adHouseCta" },
  href: "/#contact",
  image: "/assets/vehicle-hero.png",
}

// No partner booked yet, so this slot shows our own ad for now.
const PARTNER_AD = HOUSE_AD

export const BLOG_ADS = {
  house: HOUSE_AD,
  partner: PARTNER_AD,
}
