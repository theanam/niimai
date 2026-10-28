import type { Align } from '../doc/model';
import type { TemplateCode, TemplateStyle } from './layout';

export interface Category {
  id: string;
  name: string;
  font: string;
  bodyFont: string;
  style: TemplateStyle;
  upper?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'kitchen', name: 'Kitchen & pantry', font: 'Fraunces', bodyFont: 'Inter', style: 'border' },
  { id: 'spices', name: 'Spices', font: 'Playfair Display', bodyFont: 'Inter', style: 'round' },
  { id: 'home', name: 'Home organisation', font: 'Poppins', bodyFont: 'Poppins', style: 'plain' },
  { id: 'office', name: 'Office & files', font: 'Inter', bodyFont: 'Inter', style: 'divider' },
  { id: 'tech', name: 'Cables & tech', font: 'JetBrains Mono', bodyFont: 'JetBrains Mono', style: 'plain' },
  { id: 'shipping', name: 'Shipping & mail', font: 'Inter', bodyFont: 'Inter', style: 'border' },
  { id: 'retail', name: 'Retail & pricing', font: 'Space Grotesk', bodyFont: 'Space Grotesk', style: 'divider' },
  { id: 'inventory', name: 'Inventory & assets', font: 'IBM Plex Sans', bodyFont: 'IBM Plex Mono', style: 'border' },
  { id: 'moving', name: 'Moving', font: 'Archivo', bodyFont: 'Archivo', style: 'border', upper: true },
  { id: 'school', name: 'School & kids', font: 'Fredoka', bodyFont: 'Fredoka', style: 'round' },
  { id: 'health', name: 'Health & care', font: 'Nunito', bodyFont: 'Nunito', style: 'border' },
  { id: 'garden', name: 'Garden & plants', font: 'Caveat', bodyFont: 'Nunito', style: 'plain' },
  { id: 'events', name: 'Events & gifts', font: 'Playfair Display', bodyFont: 'Lato', style: 'round' },
  { id: 'workshop', name: 'Workshop & garage', font: 'Oswald', bodyFont: 'Roboto Condensed', style: 'border' },
  { id: 'lab', name: 'Lab & samples', font: 'Roboto Mono', bodyFont: 'Roboto Mono', style: 'divider' },
  { id: 'safety', name: 'Safety & warnings', font: 'Oswald', bodyFont: 'Inter', style: 'warning', upper: true },
  { id: 'media', name: 'Books & media', font: 'Merriweather', bodyFont: 'Lato', style: 'divider' },
  { id: 'personal', name: 'Personal & travel', font: 'Poppins', bodyFont: 'Poppins', style: 'border' },
  { id: 'makers', name: 'Makers & small business', font: 'DM Serif Display', bodyFont: 'DM Sans', style: 'round' },
];

/** One kind of label. Category settings apply unless a kind overrides them. */
export interface Kind {
  id: string;
  category: string;
  name: string;
  title: string;
  pre?: string;
  lines?: string[];
  code?: TemplateCode;
  style?: TemplateStyle;
  align?: Align;
  font?: string;
}

const qr = (value: string): TemplateCode => ({ type: 'qr', value });
const c128 = (value: string): TemplateCode => ({ type: 'code128', value });
const ean = (value: string): TemplateCode => ({ type: 'ean13', value });

type Row = [id: string, name: string, title: string, lines?: string[], extra?: Partial<Kind>];
const group = (category: string, rows: Row[]): Kind[] =>
  rows.map(([id, name, title, lines, extra]) => ({ id: `${category}-${id}`, category, name, title, lines, ...extra }));

export const KINDS: Kind[] = [
  ...group('kitchen', [
    ['flour', 'Flour jar', 'Flour', ['All purpose']],
    ['sugar', 'Sugar jar', 'Sugar', ['Granulated']],
    ['rice', 'Rice container', 'Basmati Rice', ['Rinse twice']],
    ['pasta', 'Pasta jar', 'Penne', ['Cook 11 min']],
    ['coffee', 'Coffee beans', 'Coffee', ['Medium roast', 'Opened 03/04']],
    ['tea', 'Tea tin', 'Earl Grey', ['Steep 3–4 min']],
    ['oats', 'Oats jar', 'Rolled Oats'],
    ['leftovers', 'Leftovers', 'Leftovers', ['Made 12/05', 'Eat by 15/05'], { style: 'divider' }],
    ['mealprep', 'Meal prep', 'Monday Lunch', ['Chicken & rice', '520 kcal']],
    ['freezer', 'Freezer bag', 'Bolognese', ['Frozen 02/06', '2 portions'], { style: 'divider' }],
    ['honey', 'Honey jar', 'Wildflower Honey', ['Local · 340 g']],
    ['baking', 'Baking soda', 'Baking Soda', ['Bicarbonate']],
    ['lunchbag', 'Lunch bag', 'Lunch', ['Please keep cold']],
    ['bread', 'Bread box', 'Sourdough', ['Baked 08/06']],
    ['water', 'Water filter', 'Filter changed', ['Next: 01/09']],
    ['nuts', 'Nuts jar', 'Almonds', ['Raw · unsalted']],
  ]),
  ...group('spices', [
    ['paprika', 'Paprika', 'Smoked Paprika', ['Best before 04/2027']],
    ['cumin', 'Cumin', 'Cumin', ['Ground']],
    ['turmeric', 'Turmeric', 'Turmeric', ['Ground']],
    ['cinnamon', 'Cinnamon', 'Cinnamon', ['Ceylon']],
    ['oregano', 'Oregano', 'Oregano', ['Dried leaves']],
    ['chili', 'Chili flakes', 'Chili Flakes', ['Hot']],
    ['garam', 'Garam masala', 'Garam Masala', ['Blend']],
    ['pepper', 'Black pepper', 'Black Pepper', ['Whole']],
    ['ginger', 'Ginger', 'Ginger', ['Ground']],
    ['thyme', 'Thyme', 'Thyme', ['Dried']],
    ['nutmeg', 'Nutmeg', 'Nutmeg', ['Whole']],
    ['cardamom', 'Cardamom', 'Cardamom', ['Green pods']],
  ]),
  ...group('home', [
    ['towels', 'Towels shelf', 'Towels'],
    ['linens', 'Bed linens', 'Bed Linen', ['Double · Grey']],
    ['toiletries', 'Toiletries', 'Toiletries'],
    ['cleaning', 'Cleaning supplies', 'Cleaning', ['Under sink']],
    ['batteries', 'Batteries', 'Batteries', ['AA · AAA']],
    ['bulbs', 'Light bulbs', 'Light Bulbs', ['E27 · Warm white']],
    ['chargers', 'Chargers drawer', 'Chargers'],
    ['seasonal', 'Seasonal box', 'Winter Clothes', ['Box 2']],
    ['remote', 'Remote control', 'Living Room TV'],
    ['spare', 'Spare keys', 'Spare Keys', ['Do not remove']],
    ['shoes', 'Shoe box', 'Running Shoes', ['Size 42']],
    ['switch', 'Light switch', 'Porch Light'],
  ]),
  ...group('office', [
    ['folder', 'File folder', 'Invoices 2026', ['Jan – Jun']],
    ['binder', 'Binder spine', 'Tax Returns', ['2020 – 2025']],
    ['desk', 'Desk name plate', 'Alex Morgan', ['Product Design']],
    ['inbox', 'Inbox tray', 'Inbox'],
    ['outbox', 'Outbox tray', 'Outbox'],
    ['archive', 'Archive box', 'Archive', ['Contracts', '2019']],
    ['confidential', 'Confidential', 'Confidential', ['Do not copy'], { style: 'warning' }],
    ['meeting', 'Meeting room', 'Room 4B', ['Seats 8']],
    ['stamp', 'Received stamp', 'Received', ['__ / __ / 2026']],
    ['ext', 'Phone extension', 'Ext. 214', ['Reception']],
    ['locker', 'Locker', 'Locker 18'],
  ]),
  ...group('tech', [
    ['cable', 'Cable flag', 'MacBook Pro', ['USB-C · 96 W']],
    ['hdmi', 'HDMI cable', 'HDMI 1', ['TV → Receiver']],
    ['usbc', 'USB-C cable', 'USB-C', ['240 W · 2 m']],
    ['adapter', 'Power adapter', 'Router PSU', ['12 V · 2 A']],
    ['wifi', 'Wi-Fi network', 'Guest Wi-Fi', ['Scan to join'], { code: qr('WIFI:T:WPA;S:Guest;P:welcome2026;;') }],
    ['port', 'Network port', 'Port 12', ['VLAN 20 · Office']],
    ['server', 'Server tag', 'nas-01', ['10.0.0.12']],
    ['breaker', 'Breaker circuit', 'Circuit 7', ['Kitchen sockets']],
    ['device', 'Device ID', 'Laptop 042', ['Serial C02XK1'], { code: c128('DEV-042') }],
    ['mac', 'MAC address', 'Living Room AP', ['3C:22:FB:9A:10:4E']],
    ['disk', 'Backup drive', 'Backup B', ['Photos · 4 TB']],
    ['sim', 'SIM card', 'Travel SIM', ['PIN 1234']],
    ['url', 'Website QR', 'Visit us', ['example.com'], { code: qr('https://example.com') }],
  ]),
  ...group('shipping', [
    ['address', 'Shipping address', 'Jamie Rivera', ['221 Baker Street', 'London NW1 6XE']],
    ['return', 'Return address', 'From: A. Ahmed', ['12 Elm Road, Leeds']],
    ['fragile', 'Fragile', 'Fragile', ['Handle with care'], { style: 'warning' }],
    ['thisway', 'This side up', 'This Side Up ↑', undefined, { style: 'warning' }],
    ['priority', 'Priority mail', 'Priority', ['Next day']],
    ['order', 'Order number', 'Order 10482', undefined, { code: c128('ORD-10482') }],
    ['tracking', 'Tracking', 'Track parcel', ['Scan for status'], { code: qr('https://example.com/track/10482') }],
    ['international', 'International', 'Air Mail', ['Par Avion']],
    ['perishable', 'Perishable', 'Perishable', ['Refrigerate'], { style: 'warning' }],
    ['heavy', 'Heavy', 'Heavy', ['Team lift'], { style: 'warning' }],
  ]),
  ...group('retail', [
    ['price', 'Price tag', '$12.99', ['Linen Tote']],
    ['sale', 'Sale tag', '−20%', ['Sale'], { style: 'warning' }],
    ['product', 'Product barcode', 'Lavender Soap', ['100 g'], { code: ean('590123412345') }],
    ['shelf', 'Shelf label', 'Oat Milk', ['$3.49 · 1 L']],
    ['sku', 'SKU tag', 'SKU 10442', undefined, { code: c128('SKU-10442') }],
    ['size', 'Size tag', 'M', ['Medium']],
    ['handmade', 'Handmade', 'Handmade', ['with love'], { style: 'round' }],
    ['clearance', 'Clearance', 'Clearance', ['Final sale']],
    ['bogo', 'Buy one get one', 'Buy 1 Get 1', ['Free']],
    ['new', 'New arrival', 'New', ['Just in']],
    ['care', 'Care label', '100% Cotton', ['Wash 30 °C']],
  ]),
  ...group('inventory', [
    ['asset', 'Asset tag', 'Acme Co.', ['Asset 00731'], { code: c128('A-00731') }],
    ['property', 'Property of', 'Property of', ['Acme Studio · Return to IT']],
    ['bin', 'Parts bin', 'M3 × 10 Screws', ['Qty 200']],
    ['service', 'Service record', 'Last Service', ['14/03/2026', 'Next: 14/09']],
    ['tool', 'Tool tag', 'Drill #4', ['Workshop B']],
    ['location', 'Shelf location', 'Aisle 3 · Shelf B', undefined, { code: c128('LOC-3B') }],
    ['qrasset', 'QR asset tag', 'Asset 1188', ['Scan for details'], { code: qr('https://example.com/asset/1188') }],
    ['calib', 'Calibration', 'Calibrated', ['Due 01/2027']],
    ['loan', 'Loan item', 'On loan', ['Return by 30/06']],
  ]),
  ...group('moving', [
    ['kitchen', 'Moving: kitchen', 'Kitchen', ['Plates · Glasses']],
    ['bedroom', 'Moving: bedroom', 'Bedroom', ['Bedding · Lamps']],
    ['bathroom', 'Moving: bathroom', 'Bathroom', ['Towels · Toiletries']],
    ['office', 'Moving: office', 'Office', ['Books · Cables']],
    ['fragile', 'Moving: fragile', 'Fragile', ['Glass inside'], { style: 'warning' }],
    ['number', 'Box number', 'Box 12 of 30'],
    ['open', 'Open first', 'Open First', ['Essentials']],
    ['living', 'Moving: living room', 'Living Room', ['Cushions · Decor']],
    ['kids', 'Moving: kids room', 'Kids Room', ['Toys · Books']],
    ['garage', 'Moving: garage', 'Garage', ['Tools']],
  ]),
  ...group('school', [
    ['name', 'Name label', 'Maya Chen', ['Class 3B']],
    ['notebook', 'Notebook subject', 'Mathematics', ['Maya · 3B']],
    ['lunch', 'Lunch box', 'Lunch', ['Maya Chen']],
    ['bottle', 'Water bottle', 'Maya', ['Class 3B']],
    ['crayons', 'Art supplies', 'Crayons'],
    ['book', 'Book owner', 'This book belongs to', ['Maya Chen']],
    ['uniform', 'Uniform tag', 'M. Chen'],
    ['pencil', 'Pencil case', 'Pencils', ['Maya C.']],
    ['homework', 'Homework folder', 'Homework', ['Due Friday']],
    ['locker', 'School locker', 'Locker 42', ['Maya Chen']],
  ]),
  ...group('health', [
    ['meds', 'Medication', 'Ibuprofen 200 mg', ['1 tablet · twice daily']],
    ['pills', 'Pill day', 'Monday', ['Morning']],
    ['allergy', 'Allergy alert', 'Allergy: Peanuts', ['Severe'], { style: 'warning' }],
    ['ice', 'Emergency contact', 'In Case of Emergency', ['Sam · +44 7700 900123']],
    ['firstaid', 'First aid kit', 'First Aid'],
    ['vitamins', 'Vitamins', 'Vitamin D', ['1000 IU · daily']],
    ['inhaler', 'Inhaler', 'Inhaler', ['2 puffs as needed']],
    ['insulin', 'Insulin', 'Insulin', ['Keep refrigerated'], { style: 'warning' }],
    ['dose', 'Dose schedule', '8 am · 2 pm · 8 pm'],
  ]),
  ...group('garden', [
    ['tomato', 'Plant marker: tomato', 'Tomato', ['Sown 12/03']],
    ['basil', 'Herb pot', 'Basil', ['Water daily']],
    ['seeds', 'Seed packet', 'Sunflower Seeds', ['Harvest 2025']],
    ['water', 'Watering schedule', 'Water: Mon · Thu'],
    ['compost', 'Compost bin', 'Compost', ['Greens & browns']],
    ['rose', 'Plant marker: rose', 'Rose', ['Planted 2024']],
    ['lavender', 'Plant marker: lavender', 'Lavender', ['Full sun']],
    ['mint', 'Plant marker: mint', 'Mint', ['Keep moist']],
    ['repot', 'Repotted', 'Repotted', ['04/2026']],
  ]),
  ...group('events', [
    ['badge', 'Name badge', 'Jordan', undefined, { pre: 'HELLO my name is' }],
    ['table', 'Table number', 'Table 7'],
    ['gift', 'Gift tag', 'To: Alex', ['From: Sam']],
    ['thanks', 'Thank you favour', 'Thank you!', ['for coming']],
    ['wine', 'Wine label', 'Château Nous', ['Est. 2026']],
    ['wifi', 'Guest Wi-Fi', 'Wi-Fi', ['Scan to connect'], { code: qr('WIFI:T:WPA;S:Party;P:celebrate;;') }],
    ['place', 'Place card', 'Priya Patel'],
    ['reserved', 'Reserved', 'Reserved'],
    ['menu', 'Menu tag', 'Vegan', ['Gluten free']],
    ['save', 'Save the date', 'Save the Date', ['14 · 09 · 2026']],
  ]),
  ...group('workshop', [
    ['screws', 'Screw drawer', 'Wood Screws', ['4 × 40 mm']],
    ['paint', 'Paint can', 'Sage Green', ['Living room · 03/2026']],
    ['bits', 'Drill bits', 'HSS Drill Bits', ['1–10 mm']],
    ['fuses', 'Fuses', 'Fuses 10 A'],
    ['oil', 'Oil change', 'Oil Changed', ['85 400 km · 05/2026']],
    ['flammable', 'Flammable', 'Flammable', ['Keep away from heat'], { style: 'warning' }],
    ['nails', 'Nails', 'Nails', ['50 mm']],
    ['wire', 'Wire spool', 'Copper 1.5 mm²'],
    ['glue', 'Glue', 'Wood Glue', ['Opened 02/2026']],
    ['tyre', 'Tyre pressure', '2.4 bar', ['Front']],
  ]),
  ...group('lab', [
    ['sample', 'Sample tube', 'S-0412', ['12/05/2026']],
    ['specimen', 'Specimen', 'Specimen 18', ['Blood · 4 °C']],
    ['reagent', 'Reagent', 'NaCl 0.9%', ['Prep 10/05 · Exp 10/08']],
    ['batch', 'Batch lot', 'Lot 2026-117', undefined, { code: c128('LOT2026117') }],
    ['culture', 'Culture plate', 'E. coli K-12', ['37 °C · 18 h']],
    ['qrsample', 'QR sample', 'Sample 7781', ['Scan record'], { code: qr('LIMS:7781') }],
    ['buffer', 'Buffer', 'PBS 1×', ['pH 7.4']],
    ['freezer', 'Freezer box', 'Box F-12', ['−80 °C']],
  ]),
  ...group('safety', [
    ['caution', 'Caution', 'Caution'],
    ['notouch', 'Do not touch', 'Do Not Touch'],
    ['hot', 'Hot surface', 'Hot Surface'],
    ['voltage', 'High voltage', 'High Voltage', ['Danger']],
    ['keepout', 'Keep out', 'Keep Out', ['Authorised only']],
    ['ppe', 'Eye protection', 'Eye Protection', ['Required']],
    ['exit', 'Exit', 'Exit →'],
    ['wet', 'Wet floor', 'Wet Floor'],
    ['noentry', 'No entry', 'No Entry'],
    ['fire', 'Fire extinguisher', 'Fire Extinguisher', ['Inspected 2026']],
  ]),
  ...group('media', [
    ['spine', 'Book spine', 'FIC ORW', ['1984']],
    ['ownbook', 'Ex libris', 'Ex Libris', ['Anam Ahmed']],
    ['dvd', 'DVD shelf', 'Documentaries'],
    ['vinyl', 'Vinyl divider', 'Jazz', ['A – F']],
    ['games', 'Game case', 'Board Games'],
    ['isbn', 'Book barcode', 'Library copy', undefined, { code: ean('978014103614') }],
    ['cd', 'CD spine', 'Kind of Blue', ['Miles Davis']],
    ['photo', 'Photo album', 'Summer 2025'],
  ]),
  ...group('personal', [
    ['found', 'Return if found', 'If found, please call', ['+44 7700 900123']],
    ['luggage', 'Luggage tag', 'R. Okafor', ['Lagos · +234 803 000 0000']],
    ['key', 'Key tag', 'Front Door'],
    ['pet', 'Pet tag', 'Biscuit', ['Call 555-0134']],
    ['bike', 'Bike ID', 'Bike ID 4471', undefined, { code: qr('https://example.com/bike/4471') }],
    ['charger', 'Charger owner', 'Property of Lee'],
    ['umbrella', 'Umbrella', 'Not yours!'],
    ['passport', 'Passport holder', 'Passport', ['A. Ahmed']],
    ['laptop', 'Laptop owner', 'Owner: Kim', ['kim@example.com']],
  ]),
  ...group('makers', [
    ['jam', 'Homemade jam', 'Strawberry Jam', ['Made 06/2026']],
    ['candle', 'Candle', 'Fig & Cedar', ['Soy wax · 200 g']],
    ['soap', 'Soap', 'Oat & Honey', ['Cold process']],
    ['ingredients', 'Ingredients', 'Ingredients', ['Flour, butter, sugar, eggs', 'Contains: gluten, egg, milk']],
    ['useby', 'Use by', 'Use by', ['21/06/2026']],
    ['brand', 'Brand sticker', 'Studio Fern', ['Made by hand']],
    ['batchcode', 'Batch code', 'Batch 0623', undefined, { code: c128('B0623') }],
    ['shop', 'Shop link', 'Shop online', ['studiofern.example'], { code: qr('https://studiofern.example') }],
    ['cookies', 'Cookie bag', 'Choc Chip Cookies', ['6 pack']],
    ['plant', 'Plant shop tag', 'Monstera', ['$24']],
    ['thanks', 'Order thank you', 'Thank you', ['for supporting small business']],
  ]),
];
