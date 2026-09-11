/**
 * Single source of truth for every piece of copy, media URL and list rendered by
 * the Bali Adventure page (mirrors mindloop's `data/mindloop.ts`). Components are
 * presentational; edit content here.
 *
 * Photography: Unsplash (photo ids below, served via images.unsplash.com).
 * Hero parallax layers: provided artwork on the strvid CDN.
 * Film: "Bali - Pura Tirta Empul (2025)" by Chainwit., CC BY 4.0, Wikimedia Commons.
 */

/** Build an Unsplash CDN URL for a photo id at a given width. */
export const unsplash = (id: string, width = 1600): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;

export const brand = {
  name: 'Bali Adventure',
  /** Two-part wordmark: display face + serif italic. */
  wordmark: ['BALI', 'adventure'] as const,
  tagline: 'Luxury journeys across the Island of the Gods',
  founded: 2014,
  email: 'concierge@baliadventure.travel',
  phone: '+62 361 555 0192',
  phoneHref: 'tel:+623615550192',
  address: 'Jalan Raya Sanggingan No. 88, Ubud, Bali 80571',
  hours: 'Concierge available daily, 07:00 – 22:00 WITA',
};

export const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Destinations', href: '#destinations' },
  { label: 'Packages', href: '#packages' },
  { label: 'Experiences', href: '#experiences' },
  { label: 'Itinerary', href: '#itinerary' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Contact', href: '#contact' },
] as const;

export const hero = {
  layers: {
    back: 'https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/s7_layer_1.png',
    mid: 'https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/s7_layer_2.png',
    front: 'https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/s7_layer_3.png',
  },
  /** Giant wordmark rendered behind the front parallax layer. */
  wordmark: 'BALI',
  eyebrow: 'Private journeys · Est. 2014 · Ubud',
  title: ['BALI', 'ADVENTURE'] as const,
  description:
    'Sunrise over Tegallalang, holy water at Tirta Empul, manta rays off Nusa Penida and a cliff-edge villa to end every day. Fully private itineraries, drawn around you by guides who grew up here.',
  primaryCta: { label: 'Explore Packages', href: '#packages' },
  secondaryCta: { label: 'View Itinerary', href: '#itinerary' },
  scrollHint: 'Scroll to begin',
};

export interface Destination {
  id: string;
  name: string;
  region: string;
  blurb: string;
  description: string;
  highlights: string[];
  /** Unsplash photo id. */
  image: string;
  alt: string;
}

export const destinations: Destination[] = [
  {
    id: 'ubud',
    name: 'Ubud',
    region: 'Central Bali · Gianyar',
    blurb: 'Rice terraces, temple springs and the island’s artistic soul.',
    description:
      'Ubud is where Bali slows to the rhythm of the gamelan. Wake to mist lifting off the Tegallalang terraces, walk the Campuhan ridge before the heat, and spend afternoons in the woodcarving and silver villages of Mas and Celuk. Evenings belong to legong dance at the palace and dinner above the Ayung River gorge.',
    highlights: [
      'Sunrise walk through the Tegallalang rice terraces before the crowds arrive',
      'Private melukat blessing at the holy springs of Tirta Empul',
      'Farm-to-table lunch overlooking the Ayung River gorge',
      'Reserved front-row seats for the Ubud Palace legong performance',
    ],
    image: '1555400038-63f5ba517a47',
    alt: 'Terraced green rice paddies of Tegallalang in Ubud, Bali',
  },
  {
    id: 'tanah-lot',
    name: 'Tanah Lot',
    region: 'West coast · Tabanan',
    blurb: 'A 16th-century sea temple stranded on its own rock at sunset.',
    description:
      'Built by the priest Dang Hyang Nirartha, Pura Tanah Lot sits on a wave-carved outcrop cut off from the mainland at high tide. We arrive as the day-trippers leave: the light turns copper, the surf booms against the base of the temple, and the holy spring beneath the rock is opened for a blessing at low tide.',
    highlights: [
      'Golden-hour photography from the quiet northern cliff path',
      'Holy-water blessing at the freshwater spring beneath the temple',
      'Cliffside dinner in a private pavilion above the surf',
      'Dawn detour to Jatiluwih’s UNESCO-listed rice landscape',
    ],
    image: '1518548419970-58e3b4079ab2',
    alt: 'Pura Tanah Lot sea temple on its rock at sunset, Bali',
  },
  {
    id: 'nusa-penida',
    name: 'Nusa Penida',
    region: 'Offshore island · Klungkung',
    blurb: 'Limestone cliffs, empty coves and reef mantas the size of cars.',
    description:
      'Forty minutes by speedboat from Sanur, Nusa Penida is the wild sister of Bali. Kelingking’s T-Rex cliff, the natural infinity pool of Angel’s Billabong and the collapsed cave of Broken Beach are all on the west coast; Manta Point lies just offshore. Leaving at first light means having them almost to yourself.',
    highlights: [
      'Private speedboat crossing from Sanur at first light',
      'Kelingking Beach from the empty upper viewpoint',
      'Snorkelling with reef manta rays at Manta Point',
      'Angel’s Billabong and Broken Beach before the day boats arrive',
    ],
    image: '1577717903315-1691ae25ab3f',
    alt: 'Kelingking Beach cliff and turquoise water on Nusa Penida',
  },
  {
    id: 'bedugul',
    name: 'Bedugul & Lake Bratan',
    region: 'Central highlands · Tabanan',
    blurb: 'A floating temple, cloud forest and strawberry farms at 1,200 m.',
    description:
      'High in the volcanic caldera north of Ubud, the air cools and the island turns to cloud forest. Pura Ulun Danu Beratan seems to float on the lake when the mist sits low; the Bali Botanic Garden and a traditional canoe crossing of Lake Tamblingan round out a day that ends in a hot spring on the way to the north coast.',
    highlights: [
      'Pura Ulun Danu Beratan at misty sunrise, before the gates open',
      'Strawberry farms and the 157-hectare Bali Botanic Garden',
      'Dug-out canoe crossing of Lake Tamblingan with a local fisherman',
      'Hot-spring soak at Banjar en route to Lovina',
    ],
    image: '1537996194471-e657df975ab4',
    alt: 'Pura Ulun Danu Beratan temple on Lake Bratan, Bedugul',
  },
  {
    id: 'sidemen',
    name: 'Sidemen & East Bali',
    region: 'Karangasem',
    blurb: 'The Gates of Heaven, weaving villages and Mount Agung’s shadow.',
    description:
      'East Bali is the island as it was: a green valley of rice and ikat weavers beneath the sacred volcano. We climb to Pura Lempuyang for the Gates of Heaven with Agung framed behind, wander the royal water palace of Tirta Gangga, and end on the black sand of Kusamba where salt is still farmed by hand.',
    highlights: [
      'Gates of Heaven at Pura Lempuyang with Mount Agung framed behind',
      'Songket and endek weaving houses of the Sidemen valley',
      'Tirta Gangga water palace and its koi-filled pools',
      'Traditional sea-salt farming on Kusamba’s black sand beach',
    ],
    image: '1531778272849-d1dd22444c06',
    alt: 'Gates of Heaven at Pura Lempuyang framing Mount Agung, East Bali',
  },
  {
    id: 'seminyak',
    name: 'Seminyak & Canggu',
    region: 'South-west coast · Badung',
    blurb: 'Beach clubs, mellow surf and villas hidden behind frangipani.',
    description:
      'The island’s most polished coastline: a long grey-sand beach lined with day beds and sunset bars, boutiques along Jalan Kayu Aya, and a surf break at Berawa gentle enough for a first lesson. Your villa comes with a private chef who shops the morning market for dinner under the frangipani.',
    highlights: [
      'Sunset beach club afternoon on Batu Belig sands',
      'Private surf lesson on Berawa’s mellow beach break',
      'Boutique and gallery walk along Jalan Kayu Aya',
      'Villa chef dinner under the frangipani trees',
    ],
    image: '1540541338287-41700207dee6',
    alt: 'Aerial view of a palm-lined beach resort on Bali’s south-west coast',
  },
];

export interface Package {
  id: string;
  name: string;
  price: number;
  /** Displayed under the price. */
  priceNote: string;
  duration: string;
  locations: string;
  summary: string;
  features: string[];
  popular?: boolean;
}

export const packages: Package[] = [
  {
    id: 'essentials',
    name: 'Island Essentials',
    price: 1290,
    priceNote: 'per person · twin share',
    duration: '5 days · 4 nights',
    locations: 'Seminyak · Ubud',
    summary: 'The classic south-and-centre loop, done privately and without a single queue.',
    features: [
      '4 nights in a boutique pool villa',
      'Private driver and English-speaking guide throughout',
      'Tegallalang sunrise walk and Tirta Empul blessing',
      'Uluwatu Kecak fire dance at sunset',
      'Daily breakfast plus two signature dinners',
      'Private airport transfers',
    ],
  },
  {
    id: 'signature',
    name: 'Signature Bali',
    price: 2450,
    priceNote: 'per person · twin share',
    duration: '8 days · 7 nights',
    locations: 'Seminyak · Ubud · Sidemen · Nusa Penida',
    summary: 'Our most requested journey: three regions, one island crossing, zero compromises.',
    features: [
      '7 nights across three hand-picked villas',
      'Private speedboat day to Nusa Penida with manta snorkelling',
      'Gates of Heaven at Pura Lempuyang before opening hours',
      'Balinese cooking class in a Sidemen family compound',
      'Boreh spa ritual and flower bath in Ubud',
      'Half-day photographer on two excursions',
      'All breakfasts, four dinners and every entrance fee',
    ],
    popular: true,
  },
  {
    id: 'odyssey',
    name: 'Private Odyssey',
    price: 4900,
    priceNote: 'per person · twin share',
    duration: '12 days · 11 nights',
    locations: 'Whole island · Nusa Lembongan',
    summary: 'Twelve days, a helicopter, a sailing charter and a concierge who never sleeps.',
    features: [
      '11 nights in cliff-edge and jungle luxury suites',
      'Helicopter transfer from Uluwatu to Ubud',
      'Mount Batur sunrise trek with private summit breakfast',
      'Two-night Nusa Lembongan sailing charter',
      'Personal wellness guide and daily yoga',
      'Chef’s-table dinners and Kintamani coffee estate visit',
      '24/7 concierge with flexible re-routing',
    ],
  },
];

export interface Experience {
  id: string;
  eyebrow: string;
  title: string;
  /** Word rendered in serif italic lime inside the title. */
  accent: string;
  description: string;
  points: string[];
  image: string;
  alt: string;
}

export const experiences: Experience[] = [
  {
    id: 'wellness',
    eyebrow: 'Spiritual wellness',
    title: 'Mornings begin in',
    accent: 'silence',
    description:
      'Bali’s Hindu rhythm is built on purification. Start with melukat — the water-cleansing ritual at Tirta Empul — then move to a rice-field yoga shala in Ubud and a two-hour boreh ritual of warm spice paste and frangipani. Your wellness guide adjusts each day to how you actually feel.',
    points: [
      'Melukat water purification at Tirta Empul, guided by a temple priest',
      'Sunrise yoga in an open-air shala above the rice paddies',
      'Balinese boreh spa ritual and flower bath at your villa',
    ],
    image: '1544644181-1484b3fdfc62',
    alt: 'Pura Ulun Danu Beratan temple with flowers in the foreground',
  },
  {
    id: 'marine',
    eyebrow: 'Marine adventures',
    title: 'The island keeps its wildest colours',
    accent: 'underwater',
    description:
      'Reef mantas glide beneath the Nusa Penida cliffs year-round; the USAT Liberty wreck at Tulamben sits in eight metres of water off a black pebble beach; the coral walls of Menjangan Island drop into the blue. Whether you snorkel or dive, boats, guides and gear are private.',
    points: [
      'Reef manta rays at Manta Point, Nusa Penida',
      'USAT Liberty shipwreck dive at Tulamben',
      'Menjangan Island’s coral walls in the far north-west',
    ],
    image: '1544551763-46a013bb70d5',
    alt: 'Scuba diver surrounded by a school of fish on a tropical reef',
  },
  {
    id: 'culinary',
    eyebrow: 'Culinary journeys',
    title: 'Taste the volcano’s',
    accent: 'soil',
    description:
      'Volcanic earth, sea salt and a spice paste called base genep shape everything eaten here. Shop the dawn market in Gianyar with a chef, cook babi guling and lawar in a Sidemen family compound, then sit down to a chef’s-table dinner in the jungle where the menu is whatever came out of the ground that morning.',
    points: [
      'Dawn market tour in Gianyar with your chef',
      'Hands-on cooking class in a Sidemen family compound',
      'Jungle chef’s-table dinner and Kintamani coffee tasting',
    ],
    image: '1559628233-100c798642d4',
    alt: 'Aerial view of terraced rice fields in Bali',
  },
];

export interface ItineraryDay {
  day: number;
  title: string;
  location: string;
  description: string;
  image: string;
  alt: string;
}

export const itinerary: ItineraryDay[] = [
  {
    day: 1,
    title: 'Arrival and a villa sunset',
    location: 'Seminyak',
    description:
      'A private car meets you at Ngurah Rai; twenty minutes later you are barefoot in a pool villa. The evening is deliberately empty: a beachfront table on Petitenget sands and the first Bintang of the trip.',
    image: '1566073771259-6a8506099945',
    alt: 'Luxury resort pool at dusk lined with palm trees',
  },
  {
    day: 2,
    title: 'Ubud: terraces, temples and jungle',
    location: 'Ubud',
    description:
      'Tegallalang before the light gets hard, a melukat blessing at Tirta Empul, then lunch above the Ayung gorge. Late afternoon on the Campuhan ridge walk; legong dance at the palace after dark.',
    image: '1552733407-5d5c46c3bb3b',
    alt: 'Jungle river valley near Ubud, Bali',
  },
  {
    day: 3,
    title: 'Highlands of Bedugul',
    location: 'Lake Bratan',
    description:
      'Climb into the caldera for Pura Ulun Danu Beratan at misty sunrise, canoe across Lake Tamblingan and end the day in the Banjar hot springs before a night in a highland lodge.',
    image: '1604999333679-b86d54738315',
    alt: 'Pura Ulun Danu Beratan temple reflected in Lake Bratan',
  },
  {
    day: 4,
    title: 'Sidemen valley and the Gates of Heaven',
    location: 'East Bali',
    description:
      'Pura Lempuyang before the gates open, with Mount Agung clear behind them. Weaving houses in Sidemen, the water palace at Tirta Gangga, and a cooking class in a family compound for dinner.',
    image: '1531778272849-d1dd22444c06',
    alt: 'Gates of Heaven at Pura Lempuyang framing Mount Agung',
  },
  {
    day: 5,
    title: 'Nusa Penida by speedboat',
    location: 'Nusa Penida',
    description:
      'Depart Sanur at first light for Kelingking, Angel’s Billabong and Broken Beach, then drop into the blue at Manta Point. Back on Bali in time for a cliff-edge dinner in Uluwatu.',
    image: '1573790387438-4da905039392',
    alt: 'Diamond Beach limestone cliffs and turquoise water on Nusa Penida',
  },
  {
    day: 6,
    title: 'Uluwatu cliffs and the Kecak fire dance',
    location: 'Bukit Peninsula',
    description:
      'A slow morning at the villa, a surf lesson or a spa ritual after lunch, then Pura Luhur Uluwatu on its 70-metre cliff for the Kecak dance as the sun drops into the Indian Ocean.',
    image: '1507525428034-b723cf961d3e',
    alt: 'Tropical beach at sunset with waves rolling in',
  },
  {
    day: 7,
    title: 'Slow morning, farewell brunch',
    location: 'Canggu',
    description:
      'Nothing before ten. A long brunch in Canggu, a last swim, and a private transfer to the airport — or extend to a Nusa Lembongan sailing charter if you are not ready to leave.',
    image: '1596394516093-501ba68a0ba6',
    alt: 'Sun loungers under umbrellas on a quiet beach',
  },
];

export type StatIcon = 'compass' | 'sparkles' | 'award' | 'star';

export interface Stat {
  icon: StatIcon;
  value: number;
  decimals?: number;
  suffix: string;
  label: string;
  description: string;
}

export const stats: Stat[] = [
  {
    icon: 'compass',
    value: 50,
    suffix: '+',
    label: 'Local guides',
    description: 'Born on the island, licensed, and fluent in its stories as well as its roads.',
  },
  {
    icon: 'sparkles',
    value: 100,
    suffix: '%',
    label: 'Custom itineraries',
    description: 'No fixed departures, no shared buses. Every route is drawn for your group alone.',
  },
  {
    icon: 'award',
    value: 12,
    suffix: '',
    label: 'Years on Bali',
    description:
      'Operating from Ubud since 2014, with the temple, villa and boat relationships to prove it.',
  },
  {
    icon: 'star',
    value: 4.9,
    decimals: 1,
    suffix: '',
    label: 'Traveller rating',
    description: 'Averaged across 2,300+ verified reviews from guests who travelled with us.',
  },
];

export interface GalleryTile {
  id: string;
  image: string;
  alt: string;
  caption: string;
  /** Tailwind span classes for the bento grid. */
  span?: string;
}

export const gallery: GalleryTile[] = [
  {
    id: 'terraces',
    image: '1555400038-63f5ba517a47',
    alt: 'Tegallalang rice terraces in Ubud',
    caption: 'Tegallalang terraces, 06:10',
    span: 'col-span-2 row-span-2',
  },
  {
    id: 'reef',
    image: '1582967788606-a171c1080cb0',
    alt: 'Colourful fish over a coral reef',
    caption: 'Reef life off Menjangan',
  },
  {
    id: 'hut',
    image: '1519046904884-53103b34b206',
    alt: 'Palm trees and a thatched hut on a tropical beach',
    caption: 'Beach hut, north coast',
  },
  {
    id: 'villa',
    image: '1571896349842-33c89424de2d',
    alt: 'Modern villa with a lit pool at night',
    caption: 'Villa pool after dark',
    span: 'col-span-2',
  },
  {
    id: 'pool',
    image: '1520250497591-112f2f40a3f4',
    alt: 'Resort pool surrounded by palm trees',
    caption: 'Morning swim, Seminyak',
  },
  {
    id: 'cliffs',
    image: '1539367628448-4bc5c9d171c8',
    alt: 'Green coastal cliffs above turquoise water',
    caption: 'Cliffs above Manta Point',
    span: 'col-span-2 row-span-2',
  },
  {
    id: 'wave',
    image: '1500375592092-40eb2168fd21',
    alt: 'A breaking ocean wave',
    caption: 'Swell at Uluwatu',
  },
  {
    id: 'palms',
    image: '1590523741831-ab7e8b8f9c7f',
    alt: 'Palm trees leaning over a sandy beach',
    caption: 'Palms on Berawa beach',
  },
  {
    id: 'lagoon',
    image: '1583037189850-1921ae7c6c22',
    alt: 'Resort pool lined with palm trees',
    caption: 'Lagoon pool, Canggu',
  },
];

export const film = {
  eyebrow: 'Watch the film',
  title: 'Where water is',
  accent: 'sacred',
  description:
    'Ninety seconds inside Pura Tirta Empul, the thousand-year-old spring temple where every journey with us begins.',
  poster: '1537996194471-e657df975ab4',
  posterAlt: 'Pura Ulun Danu Beratan temple on Lake Bratan',
  sources: [
    {
      src: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Bali_-_Pura_Tirta_Empul_%282025%29_-_vdo.webm',
      type: 'video/webm',
    },
    {
      src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/12/Bali_-_Pura_Tirta_Empul_%282025%29_-_vdo.webm/Bali_-_Pura_Tirta_Empul_%282025%29_-_vdo.webm.360p.mpeg4.mov',
      type: 'video/quicktime',
    },
  ],
  credit: {
    text: 'Footage: “Bali – Pura Tirta Empul (2025)” by Chainwit., CC BY 4.0, via Wikimedia Commons',
    href: 'https://commons.wikimedia.org/wiki/File:Bali_-_Pura_Tirta_Empul_(2025)_-_vdo.webm',
  },
};

export interface Testimonial {
  id: string;
  name: string;
  origin: string;
  trip: string;
  quote: string;
  avatar: string;
  rating: number;
}

export const testimonials: Testimonial[] = [
  {
    id: 'amelia',
    name: 'Amelia Hart',
    origin: 'London, UK',
    trip: 'Signature Bali · May 2026',
    quote:
      'We had Lempuyang to ourselves for forty minutes. Our guide Wayan had arranged it with the temple weeks earlier — that is the level of detail everywhere on this trip.',
    avatar: '1494790108377-be9c29b29330',
    rating: 5,
  },
  {
    id: 'daniel',
    name: 'Daniel Okafor',
    origin: 'Toronto, Canada',
    trip: 'Private Odyssey · February 2026',
    quote:
      'The helicopter over the Bukit was the headline, but the thing I still talk about is the salt farmer at Kusamba explaining his craft while we stood in the surf.',
    avatar: '1500648767791-00dcc994a43e',
    rating: 5,
  },
  {
    id: 'sofia',
    name: 'Sofia Marchetti',
    origin: 'Milan, Italy',
    trip: 'Island Essentials · August 2025',
    quote:
      'Five days felt like two weeks. Every transfer was on time, every villa had a pool, and the Tirta Empul blessing at dawn is something I will never forget.',
    avatar: '1534528741775-53994a69daeb',
    rating: 5,
  },
  {
    id: 'kenji',
    name: 'Kenji Watanabe',
    origin: 'Osaka, Japan',
    trip: 'Signature Bali · November 2025',
    quote:
      'I dive a lot and Manta Point still shocked me — four mantas within ten minutes, and a private boat so we never shared the water with a crowd.',
    avatar: '1507003211169-0a1dd7228f2d',
    rating: 5,
  },
  {
    id: 'lucas',
    name: 'Lucas Ferreira',
    origin: 'São Paulo, Brazil',
    trip: 'Private Odyssey · June 2025',
    quote:
      'They re-routed our whole east-Bali day when the weather turned, and it ended up being the best day of the trip. That flexibility is worth the price alone.',
    avatar: '1531427186611-ecfd6d936c79',
    rating: 5,
  },
  {
    id: 'priya',
    name: 'Priya Raman',
    origin: 'Singapore',
    trip: 'Signature Bali · March 2026',
    quote:
      'Honeymoon done right: flower baths, a photographer who knew when to disappear, and a cooking class in Sidemen where the grandmother taught us her sambal.',
    avatar: '1544005313-94ddf0286df2',
    rating: 5,
  },
];

export const booking = {
  eyebrow: 'Start planning',
  title: 'Tell us where the island should',
  accent: 'take you',
  description:
    'Share a few details and a travel designer in Ubud replies within 24 hours with a first draft itinerary, villa options and a transparent quote. No deposit until you are happy.',
  image: '1488646953014-85cb44e25828',
  imageAlt: 'Travel planning flat lay with a camera, map and notebook',
  guestsMax: 12,
  successTitle: 'Request received',
  successBody:
    'A travel designer will reply within 24 hours with a first-draft itinerary and villa options.',
};

export const footer = {
  blurb:
    'A boutique travel design studio in Ubud, crafting private, cinematic journeys across Bali and its islands since 2014.',
  explore: [
    { label: 'Destinations', href: '#destinations' },
    { label: 'Packages', href: '#packages' },
    { label: 'Experiences', href: '#experiences' },
    { label: 'Itinerary', href: '#itinerary' },
    { label: 'Gallery', href: '#gallery' },
  ],
  company: [
    { label: 'Why travel with us', href: '#why-us' },
    { label: 'Guest stories', href: '#testimonials' },
    { label: 'Watch the film', href: '#film' },
    { label: 'Plan a trip', href: '#booking' },
  ],
  newsletter: {
    title: 'The Island Letter',
    body: 'One email a month: seasonal routes, new villas and ceremonies worth planning around.',
    successBody: 'You’re on the list — the next Island Letter goes out on the 1st.',
  },
  socials: [
    { kind: 'instagram', label: 'Instagram', href: 'https://instagram.com' },
    { kind: 'youtube', label: 'YouTube', href: 'https://youtube.com' },
    { kind: 'x', label: 'X', href: 'https://x.com' },
  ] as const,
  legal: 'PT Bali Adventure Journeys · Licensed Bali tour operator',
};

export type SocialKind = (typeof footer.socials)[number]['kind'];
