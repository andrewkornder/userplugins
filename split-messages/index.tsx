/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { insertTextIntoChatInputBox } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";


const settings = definePluginSettings({
    enabled: {
        description: "Disable to turn off all functionality",
        type: OptionType.BOOLEAN,
        default: true
    },
    delay: {
        description: "Milliseconds between messages",
        type: OptionType.NUMBER,
        default: 1000
    },
});

export default definePlugin({
    name: "SplitMessages",
    description: "Split multiline messages by lines",
    authors: [{ name: "dash", id: 548007774840160260n }],
    settings,

    commands: [
        {
            name: "splitMessages",
            description: "Toggle splitting multiline messages",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "enabled",
                    description: "value (toggles if not provided)",
                    type: ApplicationCommandOptionType.BOOLEAN
                }
            ],
            execute: async (args, ctx) => {
                settings.store.enabled = findOption(args, "enabled", !settings.store.enabled);
                sendBotMessage(ctx.channel.id, {
                    content: (settings.store.enabled
                        ? "Splitting multiline messages enabled"
                        : "Disabled splitting multiline disabled"
                    ),
                });
            },
        },
    ],

    async onBeforeMessageSend(_, msg) {
        const content = msg.content.replaceAll(/\n(\s*\n)+/g, "\n");
        const i = content.indexOf("\n");
        if (i === -1) {
            return;
        }

        setTimeout(pending_content => {
            insertTextIntoChatInputBox(pending_content);
        }, settings.store.delay, content.substring(i + 1));
        msg.content = content.substring(0, i);
    }
});
