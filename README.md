# Sirus WoW Armory Extended Stats
A Tampermonkey userscript that enhances the Sirus WoW Armory character pages by adding additional stats display.

<p align="center">
  <img src="https://github.com/TurboKach/wow-sirus-extended-armory/raw/master/screenshots/preview.jpg" width="300">
</p>

## Features
- Displays additional character statistics not shown in the default UI:
  - Hit Rating (with percentage)
  - Haste Rating (with percentage)
  - Spell Penetration
  - Resilience Rating (with percentage)
  - Armor Penetration Rating (with percentage)
- Calculates stats from all sources: base stats, enchants, gems, and set bonuses
- Uses the same visual style as the original armory
- Shows all stats even when they're 0
## Installation
1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. Click [here](https://github.com/TurboKach/wow-sirus-extended-armory/raw/refs/heads/master/sirus-wow-extended-stats.user.js) to install the script
3. Visit any Sirus WoW Armory character page to see the enhanced stats
## Stat Conversion Rates
All percentages are calculated using WotLK level 80 conversion rates:
- Hit Rating: 26.23 rating = 1%
- Haste Rating: 32.79 rating = 1%
- Resilience: 81.97497559 rating = 1%
- Armor Penetration: 13.99 rating = 1%
## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
## License
[MIT](LICENSE)
