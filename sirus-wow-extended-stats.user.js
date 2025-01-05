// ==UserScript==
// @name         Sirus WoW Armory Extended Stats
// @namespace    https://github.com/TurboKach/wow-sirus-extended-armory
// @version      1.1.0
// @description  Adds additional stats display (Hit Rating, Haste, Spell Penetration, Resilience, Armor Penetration) to Sirus WoW Armory character pages
// @author       https://github.com/TurboKach
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
 * - Resilience: 94.27 rating = 1%
 * - Armor Penetration: 13.99 rating = 1%
 */




(function() {
    'use strict';

    console.log('WoW Stats Script Started');

    // Only tracking stats that aren't shown on the site
    const STAT_TYPES = {
        31: { name: 'hitRating', displayName: 'Меткость', ratingPerPercent: 26.23 },
        36: { name: 'hasteRating', displayName: 'Скорость', ratingPerPercent: 32.79 },
        37: { name: 'spellPenetration', displayName: 'Проникающая способность закл.' },
        35: { name: 'resilience', displayName: 'Устойчивость', ratingPerPercent: 94.27 },
        44: { name: 'armorPenRating', displayName: 'Пробивание брони', ratingPerPercent: 13.99 },
        32: { name: 'spellCrit', displayName: 'Крит. удар', ratingPerPercent: 26.63 },
    };

    // Stat text mappings for gem and enchant descriptions
    const STAT_TEXT_MAPPINGS = {
        'к рейтингу меткости': 'hitRating',
        'к меткости': 'hitRating',
        'к рейтингу скорости': 'hasteRating',
        'к скорости': 'hasteRating',
        'к проникающей способности заклинаний': 'spellPenetration',
        'к рейтингу устойчивости': 'resilience',
        'к устойчивости': 'resilience',
        'к пробиванию брони': 'armorPenRating',
        'к рейтингу пробивания брони': 'armorPenRating',
        'к критическому удару заклинаний': 'spellCrit',

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
            armorPenRating: 0,
            spellCrit: 0,
        };

        if (!itemData?.item) return stats;
        const item = itemData.item;

        console.log('Processing item:', item.name);

        // Process base stats
        for (let i = 1; i <= 10; i++) {
            const statType = item[`stat_type${i}`];
            const statValue = parseInt(item[`stat_value${i}`] || 0);

            if (statType && STAT_TYPES[statType]) {
                const statName = STAT_TYPES[statType].name;
                stats[statName] += statValue;
                console.log(`Added ${statValue} ${statName} from base stats`);
            }
        }

        // Process enchantments with dual-stat support
        if (item.enchantments?.name) {
            const enchText = item.enchantments.name;
            console.log('Processing enchant:', enchText);

            // Split enchant text for dual stats
            const enchantParts = enchText.split(' и ');
            enchantParts.forEach(part => {
                const enchantMatch = part.match(/\+(\d+)\s+([^]+)/);
                if (enchantMatch) {
                    const [, valueStr, statDesc] = enchantMatch;
                    const value = parseInt(valueStr);

                    for (const [statText, statName] of Object.entries(STAT_TEXT_MAPPINGS)) {
                        if (statDesc.includes(statText)) {
                            stats[statName] += value;
                            console.log(`Added ${value} ${statName} from enchant part`);
                            break;
                        }
                    }
                }
            });
        }

        // Process gems
        if (item.sockets) {
            item.sockets.forEach((socket, idx) => {
                if (socket.gem?.description) {
                    const gemDesc = socket.gem.description;
                    console.log(`Processing gem ${idx}:`, gemDesc);

                    // Handle dual-stat gems
                    const gemStats = gemDesc.split(' и ');
                    gemStats.forEach(statDesc => {
                        const gemMatch = statDesc.match(/\+(\d+)\s+([^]+)/);
                        if (gemMatch) {
                            const [, valueStr, statText] = gemMatch;
                            const value = parseInt(valueStr);

                            for (const [searchText, statName] of Object.entries(STAT_TEXT_MAPPINGS)) {
                                if (statText.includes(searchText)) {
                                    stats[statName] += value;
                                    console.log(`Added ${value} ${statName} from gem`);
                                    break;
                                }
                            }
                        }
                    });
                }
            });
        }

        // Process socket bonus if gems match the requirement
        if (item.is_right_gem_colors && item.socket_bonus_ench) {
            const bonusText = item.socket_bonus_ench.name;
            console.log('Processing socket bonus:', bonusText);

            const bonusMatch = bonusText.match(/\+(\d+)\s+([^]+)/);
            if (bonusMatch) {
                const [, valueStr, statDesc] = bonusMatch;
                const value = parseInt(valueStr);

                for (const [statText, statName] of Object.entries(STAT_TEXT_MAPPINGS)) {
                    if (statDesc.includes(statText)) {
                        stats[statName] += value;
                        console.log(`Added ${value} ${statName} from socket bonus`);
                        break;
                    }
                }
            }
        }

        console.log('Final stats for item:', stats);
        return stats;
    }

    function calculateSetBonuses(itemData) {
        const stats = {
            hitRating: 0,
            hasteRating: 0,
            spellPenetration: 0,
            resilience: 0,
            armorPenRating: 0,
            spellCrit: 0,
        };

        if (itemData?.item?.itemset_data?.setBonuses) {
            itemData.item.itemset_data.setBonuses.forEach(bonus => {
                if (bonus.used) {
                    const bonusText = bonus.spell;
                    console.log('Processing set bonus:', bonusText);

                    const bonusMatch = bonusText.match(/\+(\d+)\s+([^]+)/);
                    if (bonusMatch) {
                        const [, valueStr, statDesc] = bonusMatch;
                        const value = parseInt(valueStr);

                        for (const [statText, statName] of Object.entries(STAT_TEXT_MAPPINGS)) {
                            if (statDesc.includes(statText)) {
                                stats[statName] += value;
                                console.log(`Added ${value} ${statName} from set bonus`);
                                break;
                            }
                        }
                    }
                }
            });
        }

        return stats;
    }


    function createStatsCardFrame() {
        console.log('Creating stats card frame...');

        const mainContent = document.querySelector('.card.talents.mt-3')?.parentElement;
        if (!mainContent) {
            console.warn('Parent element not found. Waiting for it to be ready...');
            return tryCreateFrameWhenReady();
        }

        console.log('Parent element found, creating card...');

        // Remove existing stats card if present
        const existingCard = document.querySelector('.card.extra-stats');
        if (existingCard) {
            console.log('Removing existing card...');
            existingCard.remove();
        }

        // Create the main card container
        const statsCard = document.createElement('div');
        statsCard.setAttribute('data-v-43386d94', '');
        statsCard.setAttribute('data-v-46f0c0ee', '');
        statsCard.className = 'card talents mt-3 extra-stats';
        statsCard.style.display = 'block';

        // Create and append the header
        const header = document.createElement('div');
        header.setAttribute('data-v-43386d94', '');
        header.className = 'card-header';
        header.innerHTML = '<h5 data-v-43386d94="">Дополнительные характеристики<br>(бонусы от созвездий и расы не учитываются)</h5>';
        statsCard.appendChild(header);

        // Create the body
        const body = document.createElement('div');
        body.setAttribute('data-v-43386d94', '');
        body.className = 'card-body card-datatable';

        // Create the loader container
        const loaderContainer = document.createElement('div');
        loaderContainer.className = 'loader-container';
        loaderContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 150px;
        width: 100%;
    `;

        // Create the loader element
        const loader = document.createElement('div');
        loader.className = 'stats-loader';
        loader.style.cssText = `
        width: 48px;
        height: 48px;
        border: 5px solid #f3f3f3;
        border-radius: 50%;
        border-top: 5px solid #3498db;
        animation: spin 1s linear infinite;
        margin: 20px auto;
    `;

        // Add the animation keyframes if they don't exist
        if (!document.querySelector('#stats-loader-style')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'stats-loader-style';
            styleSheet.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
            document.head.appendChild(styleSheet);
        }

        // Assemble the card
        loaderContainer.appendChild(loader);
        body.appendChild(loaderContainer);
        statsCard.appendChild(body);

        console.log('Appending card to parent...');
        mainContent.appendChild(statsCard);

        return statsCard;
    }



    function tryCreateFrameWhenReady() {
        console.log('Setting up mutation observer to wait for parent element...');

        return new Promise((resolve) => {
            // First, try immediate check
            const mainContent = document.querySelector('.card.talents.mt-3')?.parentElement;
            if (mainContent) {
                console.log('Parent element found immediately');
                resolve(createStatsCardFrame());
                return;
            }

            let attempts = 0;
            const maxAttempts = 10;
            const interval = 500; // 500ms between attempts

            const checkElement = () => {
                attempts++;
                const mainContent = document.querySelector('.card.talents.mt-3')?.parentElement;

                if (mainContent) {
                    console.log('Parent element found on attempt', attempts);
                    observer.disconnect();
                    clearInterval(intervalId);
                    resolve(createStatsCardFrame());
                    return true;
                }

                if (attempts >= maxAttempts) {
                    console.log('Max attempts reached, creating card anyway...');
                    observer.disconnect();
                    clearInterval(intervalId);
                    // Try to create card even if parent not found
                    resolve(createStatsCardFrame());
                    return true;
                }

                return false;
            };

            const observer = new MutationObserver((mutations, obs) => {
                if (checkElement()) {
                    obs.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            // Also check periodically in case mutations don't trigger
            const intervalId = setInterval(() => {
                checkElement();
            }, interval);
        });
    }


    function updateStatsDisplay(totalStats, statsCard) {
        if (!statsCard) {
            console.error('Stats card not provided to updateStatsDisplay');
            return;
        }

        console.log('Updating stats display...');

        // Remove loader if it exists
        const loader = statsCard.querySelector('.loader-container');
        if (loader) {
            loader.remove();
        }

        // Get or create the card body
        let body = statsCard.querySelector('.card-body');
        if (!body) {
            body = document.createElement('div');
            body.setAttribute('data-v-43386d94', '');
            body.className = 'card-body card-datatable';
            statsCard.appendChild(body);
        }

        // Create row for columns if it doesn't exist
        let row = body.querySelector('.row');
        if (!row) {
            row = document.createElement('div');
            row.setAttribute('data-v-43386d94', '');
            row.className = 'row';
            body.appendChild(row);
        }

        // Create columns if they don't exist
        const columns = [];
        for (let i = 0; i < 3; i++) {
            let col = row.children[i];
            if (!col) {
                col = document.createElement('div');
                col.setAttribute('data-v-43386d94', '');
                col.className = 'box-col col-12 col-lg-4 col-md-6';
                row.appendChild(col);
            }
            columns.push(col);
        }

        // Calculate percentages
        const percentages = {
            hitRating: (totalStats.hitRating / STAT_TYPES[31].ratingPerPercent).toFixed(2),
            hasteRating: (totalStats.hasteRating / STAT_TYPES[36].ratingPerPercent).toFixed(2),
            spellPenetration: totalStats.spellPenetration,
            resilience: (totalStats.resilience / STAT_TYPES[35].ratingPerPercent).toFixed(2),
            spellCrit: (totalStats.spellCrit / STAT_TYPES[32].ratingPerPercent).toFixed(2)
        };

        // Define stats for each column
        const displayStats = {
            col1: {
                hitRating: { name: 'Меткость', format: (v, p) => `${v} (${p}%)` },
                hasteRating: { name: 'Скорость', format: (v, p) => `${v} (${p}%)` }
            },
            col2: {
                spellPenetration: { name: 'Проник. сп. закл.', format: (v) => `${v} (-${v})` },
                spellCrit: { name: 'Крит. удар', format: (v, p) => `${v} (${p}%)` }
            },
            col3: {
                resilience: { name: 'Устойчивость', format: (v, p) => `${v} (${p}%)` }
            }
        };

        // Clear existing content
        columns.forEach(col => col.innerHTML = '');

        // Fill columns
        Object.entries(displayStats.col1).forEach(([key, info]) => {
            const value = totalStats[key] || 0;
            const formattedValue = info.format(value, percentages[key]);
            createStatRow(columns[0], info.name, formattedValue);
        });

        Object.entries(displayStats.col2).forEach(([key, info]) => {
            const value = totalStats[key] || 0;
            const formattedValue = info.format(value, percentages[key]);
            createStatRow(columns[1], info.name, formattedValue);
        });

        Object.entries(displayStats.col3).forEach(([key, info]) => {
            const value = totalStats[key] || 0;
            const formattedValue = info.format(value, percentages[key]);
            createStatRow(columns[2], info.name, formattedValue);
        });

        console.log('Stats display updated successfully');
    }


    function createStatRow(column, name, value) {
        const newRow = document.createElement('div');
        newRow.setAttribute('data-v-43386d94', '');
        newRow.className = 'box-row';
        newRow.innerHTML = `
        <div data-v-43386d94="" class="box-item">
            <p data-v-43386d94="" class="item-name">${name}:</p>
            <p data-v-43386d94="" class="item-stats">${value}</p>
        </div>
    `;
        column.appendChild(newRow);
    }


    async function init() {
        console.log('Initializing...');
        try {
            // Create the frame and wait for it to be ready
            const statsCard = await createStatsCardFrame();
            if (!statsCard) {
                console.error('Failed to create stats card frame');
                return;
            }

            const equipment = await getCharacterEquipment();
            const totalStats = {
                hitRating: 0,
                hasteRating: 0,
                spellPenetration: 0,
                resilience: 0,
                armorPenRating: 0,
                spellCrit: 0,
            };

            let setBonusProcessed = false;
            let setBonusStats = null;

            for (const item of equipment) {
                if (item.entry && item.guid) {
                    try {
                        const itemData = await fetchItemData(item.entry, item.guid);
                        const itemStats = calculateItemStats(itemData);

                        if (!setBonusProcessed && itemData.item?.itemset_data?.setBonuses) {
                            setBonusStats = calculateSetBonuses(itemData);
                            setBonusProcessed = true;
                        }

                        Object.keys(totalStats).forEach(key => {
                            totalStats[key] += itemStats[key];
                        });
                    } catch (error) {
                        console.error(`Error processing item ${item.entry}:`, error);
                    }
                }
            }

            if (setBonusStats) {
                Object.keys(totalStats).forEach(key => {
                    totalStats[key] += setBonusStats[key];
                });
            }

            updateStatsDisplay(totalStats, statsCard);
        } catch (error) {
            console.error('Error in init:', error);
        } finally {
        }
    }

    // Start when page is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
