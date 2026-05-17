/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { currentNotice, noticesQueue, popNotice, showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import {
    FluxDispatcher,
} from "@webpack/common";


const logger = new Logger("ShuntNotifications");


const settings = definePluginSettings({
    idleTimeout: {
        description: "Minutes before Discord goes idle (0 to disable auto-idle)",
        type: OptionType.SLIDER,
        markers: makeRange(0, 60, 5),
        default: 10,
        stickToMarkers: false,
        restartNeeded: true // Because of the setInterval patch
    },
    remainInIdle: {
        description: "When you come back to Discord, remain idle until you confirm you want to go online",
        type: OptionType.BOOLEAN,
        default: true
    },
});


const uncond_log = event => logger.log(event);
const cond_log = event => {
    // if (CHANNEL_WHITELIST.includes(event.channelId)) {
    //     logger.log(event);
    // }
};


export default definePlugin({
    name: "ShuntNotifications",
    description: "Switch notifications to other devices on command",
    authors: [{ name: "dash", id: 548007774840160260n }],
    settings,

    flux: {
        AFK: uncond_log,
        APP_DM_OPEN: uncond_log,
        GENERIC_PUSH_NOTIFICATION_SENT: uncond_log,
        // HABITUAL_DND_CLEAR: uncond_log,
        IDLE: uncond_log,

        // MESSAGE_CREATE: cond_log,
        // MESSAGE_DELETE: cond_log,
        // MESSAGE_DELETE_BULK: cond_log,

        // MESSAGE_NOTIFICATION_SHOWN: uncond_log,

        // MESSAGE_REACTION_ADD: cond_log,
        // MESSAGE_REACTION_ADD_MANY: cond_log,
        // MESSAGE_REACTION_ADD_USERS: cond_log,
        // MESSAGE_UPDATE: cond_log,

        // NOTIFICATION_CLICK: uncond_log,
        // NOTIFICATION_CREATE: uncond_log,
        // NOTIFICATION_SETTINGS_UPDATE: uncond_log,
        // PUSH_NOTIFICATION_CLICK: uncond_log,

        // SEARCH_ADD_HISTORY: uncond_log,
        // SEARCH_EDITOR_STATE_CHANGE: uncond_log,
        // SEARCH_EDITOR_STATE_CLEAR: uncond_log,
        // SEARCH_ENSURE_SEARCH_STATE: uncond_log,
        // SEARCH_FINISH: uncond_log,
        // SEARCH_MESSAGES_CLEAR_ALL: uncond_log,
        // SEARCH_MESSAGES_START: uncond_log,
        // SEARCH_MESSAGES_SUCCESS: uncond_log,
        // SEARCH_SCREEN_OPEN: uncond_log,
        // SEARCH_START: uncond_log,
    },

    commands: [{
        name: "shunt",
        description: "Start sending notifications to phone",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [
            {
                name: "delay",
                description: "How many seconds to wait before shunting",
                required: false,
                type: ApplicationCommandOptionType.INTEGER,
            },
        ],
        execute: async (args, ctx) => {
            const delay = findOption(args, "delay", 5);
            sendBotMessage(ctx.channel.id, {
                content: `Shunting notifications to phone in ${delay} seconds...`,
            });

            setTimeout(async () => {
                sendBotMessage(ctx.channel.id, {
                    content: "Shunting notifications to phone...",
                });
                logger.log("Sending idle event...");
                FluxDispatcher.dispatch({
                    type: "IDLE",
                    idle: true
                });
            }, delay * 1000);
        },
    }],
    patches: [
        {
            find: 'type:"IDLE",idle:',
            replacement: [
                {
                    match: /(?<=Date\.now\(\)-\i>)\i\.\i\|\|/,
                    replace: "$self.getIdleTimeout()||"
                },
                // {
                //     match: /Math\.min\((\i\*\i\.\i\.\i\.SECOND),\i\.\i\)/,
                //     replace: "$1" // Decouple idle from afk (phone notifications will remain at user setting or 10 min maximum)
                // },
                {
                    match: /\i\.\i\.dispatch\({type:"IDLE",idle:!1}\)/,
                    replace: "$self.handleOnline()"
                }
            ]
        }
    ],

    async start() {
    },

    handleOnline() {
        if (!settings.store.remainInIdle) {
            FluxDispatcher.dispatch({
                type: "IDLE",
                idle: false
            });
            return;
        }

        const backOnlineMessage = "Welcome back! Click the button to go online. Click the X to stay idle until reload.";
        if (
            currentNotice?.[1] === backOnlineMessage ||
            noticesQueue.some(([, noticeMessage]) => noticeMessage === backOnlineMessage)
        ) return;

        showNotice(backOnlineMessage, "Exit idle", () => {
            popNotice();
            FluxDispatcher.dispatch({
                type: "IDLE",
                idle: false
            });
        });
    },

    getIdleTimeout() { // milliseconds, default is 6e5
        const { idleTimeout } = settings.store;
        return idleTimeout === 0 ? Infinity : idleTimeout * 60000;
    },
});
