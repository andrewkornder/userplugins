/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { Plugin } from "@utils/types";

import { PluginMeta } from "~plugins";


const logger = new Logger("Misc");


const settings = definePluginSettings({
});

const isApiPlugin = (plugin: Plugin) => plugin.name?.endsWith("API") || plugin.required;


export default definePlugin({
    name: "!Misc",
    description: "Whatever I wanted to add that didn't deserve its own plugin",
    authors: [{ name: "dash", id: 548007774840160260n }],
    settings,

    flux: {
    },
    commands: [{
        name: "printEnabledPlugins",
        description: "",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [
        ],
        execute: async (_, ctx) => {
            const plugins: string[] = [];
            const userplugins: string[] = [];
            Object.values(Vencord.Plugins.plugins).filter(plugin => !isApiPlugin(plugin) && plugin.started).forEach(plugin => {
                if (PluginMeta[plugin.name]?.userPlugin) {
                    userplugins.push(plugin.name);
                } else {
                    plugins.push(plugin.name);
                }
            });
            sendBotMessage(ctx.channel.id, {
                content: `# Plugins:\n- ${plugins.join("\n- ")}\n# User plugins:\n- ${userplugins.join("\n- ")}`
            });
        },
    }],
});
