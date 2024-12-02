// ==UserScript==
// @name         Sirus WoW Armory Extended Stats
// @namespace    https://github.com/TurboKach/wow-sirus-extended-armory
// @version      1.0.0
// @description  Adds additional stats display (Hit Rating, Haste, Spell Penetration, Resilience, Armor Penetration) to Sirus WoW Armory character pages
// @author       Your Name
// @match        https://sirus.su/base/character/*
// @grant        GM_xmlhttpRequest
// @connect      sirus.su
// @license      MIT
// @homepage     https://github.com/TurboKach/wow-sirus-extended-armory
// @supportURL   https://github.com/TurboKach/wow-sirus-extended-armory/issues
// @updateURL    https://raw.githubusercontent.com/TurboKach/wow-sirus-extended-armory/master/sirus-wow-extended-stats.user.js
// @downloadURL  https://raw.githubusercontent.com/TurboKach/wow-sirus-extended-armory/master/sirus-wow-extended-stats.user.js
// ==/UserScript==

/* 
 * Sirus WoW Armory Extended Stats
 * 
 * This script enhances the Sirus WoW Armory character pages by adding a new stats panel
 * that shows additional character statistics including:
 * - Hit Rating (with percentage)
 * - Haste Rating (with percentage)
 * - Spell Penetration
 * - Resilience Rating (with percentage)
 * - Armor Penetration Rating (with percentage)
 *
 * Stats are calculated from:
 * - Base item stats
 * - Enchantments
 * - Gems
 * - Set bonuses
 *
 * Conversion rates at level 80:
 * - Hit Rating: 26.23 rating = 1%
 * - Haste Rating: 32.79 rating = 1%
 * - Resilience: 81.97497559 rating = 1%
 * - Armor Penetration: 13.99 rating = 1%
 */


(function() {
    'use strict';

    console.log('WoW Stats Script Started');

    // Only tracking stats that aren't shown on the site
    const STAT_TYPES = {
        31: { name: 'hitRating', displayName: 'Меткость' },
        36: { name: 'hasteRating', displayName: 'Скорость' },
        37: { name: 'spellPenetration', displayName: 'Пробивание закл.' },
        35: { name: 'resilience', displayName: 'Устойчивость' },
        44: { name: 'armorPenRating', displayName: 'Пробивание брони' }
    };

    // Wait for element to appear
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkElement = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout waiting for ${selector}`));
                    return;
                }

                setTimeout(checkElement, 100);
            };

            checkElement();
        });
    }

    async function getCharacterEquipment() {
        try {
            console.log('Starting equipment search...');

            await waitForElement('.inventory');

            // Get character name and realm from URL
            const urlMatch = window.location.pathname.match(/\/character\/([^\/]+)\/([^\/]+)/);
            if (!urlMatch) {
                throw new Error('Could not parse character info from URL');
            }

            const [, realm, charName] = urlMatch;
            console.log(`Found character: ${charName} on realm: ${realm}`);

            // Get character ID from API
            const response = await fetch(`https://sirus.su/api/base/42/character/${charName}?lang=ru`);
            const charData = await response.json();

            if (!charData.character?.guid) {
                throw new Error('Could not get character GUID from API');
            }

            const characterId = charData.character.guid;
            console.log('Found character ID:', characterId);

            const items = [];
            const slotSelectors = [
                '.inventory__left a.item',
                '.inventory__right a.item',
                '.inventory__bottom a.item'
            ];

            // Collect all items
            slotSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(slot => {
                    const href = slot.getAttribute('href');
                    if (href) {
                        const match = href.match(/\/item\/(\d+)/);
                        if (match) {
                            items.push({
                                entry: match[1],
                                guid: characterId
                            });
                        }
                    }
                });
            });

            console.log('Found equipped items:', items);

            if (items.length === 0) {
                throw new Error('No items found in inventory');
            }

            return items;
        } catch (e) {
            console.error('Error getting character equipment:', e);
            throw e;
        }
    }

    async function fetchItemData(itemId, characterId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://sirus.su/api/base/x1/tooltip/item/${itemId}/${characterId}`,
                headers: {
                    'Accept': 'application/json'
                },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        console.log(`Received data for item ${itemId}:`, data);
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: reject
            });
        });
    }

    function calculateItemStats(itemData) {
        const stats = {
            hitRating: 0,
            hasteRating: 0,
            spellPenetration: 0,
            resilience: 0,
            armorPenRating: 0
        };

        // At the start of calculateItemStats:
        if (!itemData?.item) return stats;
        const item = itemData.item;

        console.log('Processing item:', item.name);
        console.log('Raw stat types:');
        for (let i = 1; i <= 10; i++) {
            const statType = item[`stat_type${i}`];
            const statValue = item[`stat_value${i}`];
            if (statType && statValue) {
                console.log(`stat_type${i}: ${statType}, value: ${statValue}`);
            }
        }

        // Process base stats
        for (let i = 1; i <= 10; i++) {
            const statType = item[`stat_type${i}`];
            const statValue = parseInt(item[`stat_value${i}`] || 0);

            if (statType && STAT_TYPES[statType]) {
                const statName = STAT_TYPES[statType].name;
                stats[statName] += statValue;
                console.log(`Added ${statValue} to ${statName} from base stats`);
            }
        }

        // Process enchantments
        if (item.enchantments?.name) {
            const enchText = item.enchantments.name;
            console.log('Processing enchant:', enchText);

            if (enchText.includes('к проникающей способности заклинаний')) {
                const match = enchText.match(/\+(\d+)/);
                if (match) {
                    const value = parseInt(match[1]);
                    stats.spellPenetration += value;
                    console.log(`Added ${value} to spell penetration from enchant`);
                }
            }

            if (enchText.includes('к рейтингу устойчивости')) {
                const match = enchText.match(/\+(\d+)/);
                if (match) {
                    stats.resilience += parseInt(match[1]);
                    console.log(`Added ${match[1]} to resilience from enchant`);
                }
            }
        }

        // Process gems
        if (item.sockets) {
            item.sockets.forEach((socket, idx) => {
                if (socket.gem?.description) {
                    const gemDesc = socket.gem.description;
                    console.log(`Processing gem ${idx}:`, gemDesc);

                    if (gemDesc.includes('к проникающей способности заклинаний')) {
                        const match = gemDesc.match(/\+(\d+)/);
                        if (match) {
                            const value = parseInt(match[1]);
                            stats.spellPenetration += value;
                            console.log(`Added ${value} to spell penetration from gem`);
                        }
                    }

                    if (gemDesc.includes('к рейтингу устойчивости')) {
                        const match = gemDesc.match(/\+(\d+)/);
                        if (match) {
                            stats.resilience += parseInt(match[1]);
                            console.log(`Added ${match[1]} to resilience from gem`);
                        }
                    }
                }
            });
        }

        console.log('Final stats for item:', stats);
        return stats;
    }

    function updateStatsDisplay(totalStats) {
        const mainContent = document.querySelector('.card.talents.mt-3').parentElement;
        if (!mainContent) return;

        // Check if our stats card already exists
        let statsCard = document.querySelector('.card.extra-stats');
        if (!statsCard) {
            // Create new card
            statsCard = document.createElement('div');
            statsCard.className = 'card extra-stats mt-3';

            // Add header
            const header = document.createElement('div');
            header.className = 'card-header';
            header.innerHTML = '<h5>Дополнительные характеристики</h5>';
            statsCard.appendChild(header);

            // Add body
            const body = document.createElement('div');
            body.className = 'card-body card-datatable';

            // Add row and column structure similar to original stats
            const row = document.createElement('div');
            row.className = 'row';

            const col = document.createElement('div');
            col.className = 'box-col col-12';

            row.appendChild(col);
            body.appendChild(row);
            statsCard.appendChild(body);

            // Insert after talents card
            mainContent.appendChild(statsCard);
        }

    // Calculate percentages (even for 0 values)
    const percentages = {
        hitRating: (totalStats.hitRating / 26.23).toFixed(2),
        hasteRating: (totalStats.hasteRating / 32.79).toFixed(2),
        spellPenetration: totalStats.spellPenetration,
        resilience: (totalStats.resilience / 81.97497559).toFixed(2),
        armorPenRating: (totalStats.armorPenRating / 13.99).toFixed(2)
    };

    const displayStats = {
        hitRating: { name: 'Меткость', format: (v, p) => `${v} (${p}%)` },
        hasteRating: { name: 'Скорость', format: (v, p) => `${v} (${p}%)` },
        spellPenetration: { name: 'Пробивание закл.', format: (v) => `${v} (-${v})` },
        resilience: { name: 'Устойчивость', format: (v, p) => `${v} (${p}%)` },
        armorPenRating: { name: 'Пробивание брони', format: (v, p) => `${v} (${p}%)` }
    };

    // Get the column to put our stats in
    const statsColumn = statsCard.querySelector('.box-col');
    statsColumn.innerHTML = ''; // Clear existing stats

    // Always show all stats, even if 0
    Object.entries(displayStats).forEach(([key, info]) => {
        const value = totalStats[key] || 0;
        const formattedValue = info.format(value, percentages[key]);
        const newRow = document.createElement('div');
        newRow.className = 'box-row';
        newRow.innerHTML = `
            <div class="box-item">
                <p class="item-name">${info.name}:</p>
                <p class="item-stats">${formattedValue}</p>
            </div>
        `;
        statsColumn.appendChild(newRow);
    });
}

    async function init() {
        try {
            const equipment = await getCharacterEquipment();

            const totalStats = {
                hitRating: 0,
                hasteRating: 0,
                spellPenetration: 0,
                resilience: 0,
                armorPenRating: 0
            };

            for (const item of equipment) {
                if (item.entry && item.guid) {
                    try {
                        const itemData = await fetchItemData(item.entry, item.guid);
                        const itemStats = calculateItemStats(itemData);

                        Object.keys(totalStats).forEach(key => {
                            totalStats[key] += itemStats[key];
                        });
                    } catch (error) {
                        console.error(`Error processing item ${item.entry}:`, error);
                    }
                }
            }

            updateStatsDisplay(totalStats);

        } catch (error) {
            console.error('Error in init:', error);
        }
    }

    // Start when page is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
