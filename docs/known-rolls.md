# Known NIIMBOT rolls

The barcode on a NIIMBOT roll's RFID tag is its retail EAN-13 (or, for some rolls bundled with printers, a short code). niimai looks codes up in `src/printer/known-rolls.json` to fill in the label size for printers that do not report it.

Sizes follow niimai's orientation: for D-series strips, width is along the strip and height is across it; for B-series and larger rolls, width is across the roll and height along it. Cable rolls are 109 mm long with a 35 mm tail and a flag that folds at its middle.

Codes marked *verified* were read from real rolls. Others come from shop and barcode-database listings that show the code and size together. To add a roll, add it to the JSON and to this table with a source.

| Code | Size (mm) | Roll | Confidence | Sources |
| --- | --- | --- | --- | --- |
| `6972842743589` | 30 × 15 | RP15×30 white | verified | [1](https://go-upc.com/search?q=6972842743589), [2](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [3](https://niimbots.com/products/niimbot-thermal-label-maker-paper-white-stickers-waterproof-for-d11-d110), [4](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6971501224599` | 30 × 15 | 15×30 white | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://go-upc.com/search?q=6971501224599) |
| `02282280` | 30 × 15 | 15×30 white (printer starter roll) | medium | [1](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6972842743565` | 30 × 12 | RP12×30 white | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [3](https://go-upc.com/search?q=6972842743565) |
| `6971501224568` | 30 × 12 | 12×30 white | medium | [1](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6971501229778` | 30 × 12 | 12×30 white | medium | [1](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6972842747594` | 30 × 12 | 12×30 white | medium | [1](https://niimbots.com/products/niimbot-thermal-label-maker-paper-white-stickers-waterproof-for-d11-d110) |
| `6971501224582` | 26 × 15 | 15×26 white | medium | [1](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6971501224605` | 50 × 15 | 15×50 white | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://go-upc.com/search?q=6971501224605) |
| `6972842743596` | 50 × 15 | RP15×50 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://niimbots.com/products/niimbot-thermal-label-maker-paper-white-stickers-waterproof-for-d11-d110), [3](https://go-upc.com/search?q=6972842743596) |
| `6972842743558` | 22 × 12 | RP12×22 white | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [3](https://go-upc.com/search?q=6972842743558), [4](https://niimbots.com/products/niimbot-thermal-label-maker-paper-white-stickers-waterproof-for-d11-d110) |
| `6971501224551` | 22 × 12 | 12×22 white | medium | [1](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6972842743572` | 40 × 12 | RP12×40 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://niimbots.com/products/niimbot-thermal-label-maker-paper-white-stickers-waterproof-for-d11-d110), [3](https://go-upc.com/search?q=6972842743572) |
| `01222281` | 40 × 12 | 12×40 white (printer starter roll) | medium | [1](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6972842743640` | 40 × 12 | RP12×40 pink | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://go-upc.com/search?q=6972842743640) |
| `6972842743657` | 40 × 12 | RP12×40 green | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [2](https://go-upc.com/search?q=6972842743657) |
| `6972842743664` | 40 × 12 | RP12×40 blue | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [2](https://go-upc.com/search?q=6972842743664) |
| `6972842743671` | 40 × 12 | RP12×40 yellow | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://go-upc.com/search?q=6972842743671) |
| `10252110` | 75 × 12 | 12×75 white (printer starter roll) | medium | [1](https://github.com/vookimedlo/vooki-thermo-printer) |
| `6975746637480` | 40 × 14 | RP14×40 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://go-upc.com/search?q=6975746637480) |
| `6972842743831` | 40 × 14 | 14×40 transparent | medium | [1](https://niimbots.com/products/niimbot-transparent-label-maker-tape-labeling-tape-for-d11-d110) |
| `6977388399351` | 40 × 14 | T14×40 transparent, planets print | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/) |
| `6972842743725` | 30 × 14 | T14×30 transparent | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://niimbots.com/products/niimbot-transparent-label-maker-tape-labeling-tape-for-d11-d110), [3](https://go-upc.com/search?q=6972842743725) |
| `6975746633727` | 60 × 14 | RP14×60 white | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/) |
| `6975746633703` | 28 × 14 | R14×28 white, rounded | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/) |
| `6975746630696` | 28 × 14 | 14×28 white, rounded | medium | [1](https://niimbots.com/products/round-label-tape-for-d11-d110-d101-h1s), [2](https://niimbots.com/products/niimbot-thermal-label-maker-paper-white-stickers-waterproof-for-d11-d110) |
| `6975746633710` | 28 × 14 | 14×28 transparent, rounded | medium | [1](https://niimbots.com/products/round-label-tape-for-d11-d110-d101-h1s) |
| `6972842743817` | 74 + 35 × 12.5 | RXL12.5×109 cable, red | verified | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://tygotec.cz/niimbot-stitky-na-kabely-rxl-12-5x109mm-60ks-red-pro-d11-a-d110/), [3](https://go-upc.com/search?q=6972842743817) |
| `6972842743787` | 74 + 35 × 12.5 | RXL12.5×109 cable, white | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [3](https://niimbots.com/products/niimbot-thermal-label-maker-paper-white-stickers-waterproof-for-d11-d110) |
| `6972842743824` | 74 + 35 × 12.5 | RXL12.5×109 cable, yellow | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [3](https://go-upc.com/search?q=6972842743824) |
| `6972842743800` | 74 + 35 × 12.5 | RXL12.5×109 cable, green | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [3](https://go-upc.com/search?q=6972842743800) |
| `6972842743794` | 74 + 35 × 12.5 | RXL12.5×109 cable, blue | high | [1](https://github.com/vookimedlo/vooki-thermo-printer), [2](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [3](https://go-upc.com/search?q=6972842743794) |
| `6971501227095` | 74 + 35 × 12.5 | 12.5×109 cable, white | medium | [1](https://niimbots.com/products/niimbot-thermal-label-maker-paper-waterproof-cable-stickers) |
| `6971501227941` | 50 × 30 | R50×30 white | verified | [1](https://niimbots.com/products/niimbot-white-label-tape-for-b1-b21-b3s), [2](https://go-upc.com/search?q=6971501227941), [3](https://tintasycartuchos.com/material-de-oficina-y-papeleria/72000-50x30mm-r2-niimbot-etiquetas-de-transferencia-termica-50-x-30mm-230-etiquetas-por-rollo-para-b21-6971501227941.html) |
| `6975746632782` | 50 × 30 | R50×30 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://go-upc.com/search?q=6975746632782) |
| `6977388391393` | 50 × 30 | 50×30 clear | medium | [1](https://niimbots.com/products/niimbot-clear-lable-for-b1-b21-b3s) |
| `6975746632799` | 40 × 30 | R40×30 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [2](https://go-upc.com/search?q=6975746632799) |
| `6975746632805` | 40 × 30 | ER40×30 transparent | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [2](https://niimbots.com/products/niimbot-clear-lable-for-b1-b21-b3s), [3](https://go-upc.com/search?q=6975746632805) |
| `6975746633550` | 30 × 20 | R30×20 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://go-upc.com/search?q=6975746633550) |
| `6975746633567` | 40 × 20 | R40×20 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://go-upc.com/search?q=6975746633567) |
| `6971501227743` | 40 × 20 | 40×20 white | medium | [1](https://niimbots.com/products/niimbot-white-label-tape-for-b1-b21-b3s) |
| `6975746630238` | 40 × 20 | 40×20 clear | medium | [1](https://niimbots.com/products/niimbot-clear-lable-for-b1-b21-b3s) |
| `6977388396039` | 45 × 20 | R45×20 white | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/) |
| `6975746633574` | 40 × 40 | R40×40 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://go-upc.com/search?q=6975746633574) |
| `6975746632775` | 50 × 50 | R50×50 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/), [2](https://niimbots.com/products/niimbot-white-label-tape-for-b1-b21-b3s), [3](https://go-upc.com/search?q=6975746632775) |
| `6975746633581` | 50 × 50 | R50×50 round | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [2](https://niimbots.com/products/niimbot-label-clear-round-50mm-for-b1-b21-b3s) |
| `6975746630467` | 50 × 50 | 50×50 round, white | medium | [1](https://niimbots.com/products/niimbot-white-label-tape-for-b1-b21-b3s) |
| `6975746634397` | 50 × 50 | 50×50 round, clear | medium | [1](https://niimbots.com/products/niimbot-clear-lable-for-b1-b21-b3s) |
| `6975746633734` | 31 × 31 | 31×31 round, clear | medium | [1](https://niimbots.com/products/niimbot-clear-lable-for-b1-b21-b3s) |
| `6975746630344` | 31 × 31 | 31×31 round, clear | medium | [1](https://niimbots.com/products/niimbot-label-clear-round-50mm-for-b1-b21-b3s) |
| `6975746630429` | 34 × 34 | 34×34 round, colourful | medium | [1](https://niimbots.com/products/colorful-thermal-label-paper-for-b21-b1-b3s) |
| `6975746637442` | 21 × 21 | R21×21 round | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/) |
| `6975746634472` | 50 × 70 | R50×70 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [2](https://go-upc.com/search?q=6975746634472) |
| `6975746633598` | 50 × 80 | R50×80 white | high | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/), [2](https://go-upc.com/search?q=6975746633598) |
| `6971501220607` | 50 × 80 | 50×80 white | medium | [1](https://niimbots.com/products/niimbot-white-label-tape-for-b1-b21-b3s) |
| `6975746634540` | 40 × 70 | 40×70 white | medium | [1](https://niimbots.com/products/niimbot-white-label-tape-for-b1-b21-b3s) |
| `6977031219562` | 40 × 60 | R40×60 white | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/) |
| `6977388399405` | 45 × 60 | R45×60 white | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/) |
| `6975746637503` | 70 × 40 | RP70×40 white (B3S) | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace-strana-2/) |
| `6977388396053` | 70 × 80 | RP70×80 white (B3S) | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/) |
| `6977031215595` | 60 × 80 | RP60×80 white (B3S) | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/) |
| `6977031213478` | 50 × 30 | PL50×30 white (M2 thermal transfer) | medium | [1](https://tygotec.cz/domacnost/prislusenstvi-stitkovace/) |
