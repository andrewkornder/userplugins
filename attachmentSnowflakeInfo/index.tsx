/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { DataStore } from "@api/index";
import { addMessageAccessory } from "@api/MessageAccessories";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import { useForceUpdater } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, DateUtils, NavigationRouter, SnowflakeUtils, TextInput, useEffect, UserStore, useState } from "@webpack/common";

const logger = new Logger("SnowflakeInfo");
export const cl = classNameFactory("vc-snowflakeInfo-");

const attachmentPattern = /\bhttps:\/\/(?:media\.discordapp\.net|cdn\.discordapp\.com)\/attachments\/((\d+)\/(\d+))\/([a-zA-Z0-9\-._~]+)\b/;

type Attachment = {
    link: string,
    name: string,
    channel: string,
    snowflake: string
};

const ID_TO_NAME_KEY = "snowflake-info-channelIDs";
let customIDtoName: Map<string, string> = new Map();

function getPossibleAttachments(message: any): string[] {
    const attachments: string[] = [];
    if (message.message_snapshots) {
        for (const item of message.message_snapshots) {
            attachments.push(...getPossibleAttachments(item.message));
        }
    }
    for (const items of [message.embeds, message.attachments]) {
        if (!items) continue;

        for (const item of items) {
            if (item.url) {
                attachments.push(item.url);
            } else if (item.proxy_url) {
                attachments.push(item.proxy_url);
            }
        }
    }

    for (const m of message.content.matchAll(new RegExp(attachmentPattern, "g"))) {
        attachments.push(m[0]);
    }
    return attachments;
}
function getAttachments(message: Record<string, any>): Attachment[] {
    const links = getPossibleAttachments(message);
    links.sort();

    const filtered = new Map<string, Attachment>();
    for (const link of links) {
        const m = link.match(attachmentPattern);
        if (m) {
            filtered.set(m[1], { link: link, name: m[4], channel: m[2], snowflake: m[3] });
        }
    }
    return [...filtered.values()];
}

async function cleanAndStoreMappings(change: boolean) {
    if (change) {
        const fixed = new Map();
        for (const [key, value] of customIDtoName.entries().toArray().sort((a, b) => {
            if (a[0].length === 0) return +1;
            if (b[0].length === 0) return -1;
            return Number(a[0]) - Number(b);
        })) {
            if (value.length !== 0) {
                fixed.set(key, value.trim());
            }
        }
        fixed.delete("");
        if (!fixed.size) {
            fixed.set("", "");
        }
        customIDtoName = fixed;
    }
    logger.log("Setting mapping settings to", customIDtoName);
    await DataStore.set(ID_TO_NAME_KEY, customIDtoName);
    settings.store.mappingsJSON = JSON.stringify(customIDtoName);
}

function CustomIDMappingSettings() {
    const update = useForceUpdater();
    const [mapping] = useState(customIDtoName);
    const [toMerge, setToMerge] = useState("");
    const [hasMergeError, setHasMergeError] = useState(false);

    useEffect(() => {
        return () => {
            cleanAndStoreMappings(true).finally(() => { });
        };
    }, []);

    async function onChangeLocal() {
        cleanAndStoreMappings(false);
        update();
    }

    const elements = mapping.entries().map(entry => {
        const [key, value] = entry;
        return (<>
            <div className={cl("config-mapping-row")}>
                <TextInput
                    placeholder="ID ([0-9]+)"
                    spellCheck={false}
                    value={key}
                    onChange={async e => {
                        e = (e as string).replaceAll(/\D/g, "");
                        if (e !== key) {
                            customIDtoName.set(e, value);
                            customIDtoName.delete(key);
                        }
                        await onChangeLocal();
                    }}
                />
                <TextInput
                    placeholder="Name"
                    spellCheck={false}
                    value={value}
                    onChange={async e => {
                        customIDtoName.set(key, e);
                        await onChangeLocal();
                    }}
                />
            </div>
        </>);
    });
    return (
        <>
            <div>
                <TextInput placeholder="Merge JSON ([str: str])" spellCheck={false} value={toMerge} onChange={async e => {
                    setToMerge(e);
                }} />
                <Button onClick={async () => {
                    const parsed = new Map<string, string>();
                    try {
                        const json = JSON.parse(toMerge);
                        for (const [key, value] of Object.entries(json)) {
                            if (typeof key !== "string" || typeof value !== "string") {
                                throw "";
                            }
                            parsed.set(key, value);
                        }
                    } catch (error) {
                        setHasMergeError(true);
                        await onChangeLocal();
                        return;
                    }

                    setToMerge("");
                    setHasMergeError(false);
                    for (const [key, value] of parsed) {
                        customIDtoName.set(key, value);
                    }
                    await onChangeLocal();
                }}>Merge</Button>
            </div>
            {elements}
            <div><Button onClick={async () => {
                if (!customIDtoName.has("")) {
                    customIDtoName.set("", "");
                }
                await onChangeLocal();
            }}>Add custom name</Button></div>
        </>
    );
}

function RenameModal({ rootProps, id, value }) {
    const [rename, updater] = useState(value);
    return (<ModalRoot {...rootProps}>
        <ModalHeader className={cl("modal-header")}>
            <Heading className={cl("modal-title")}>
                {`Add Name For Unknown ID: ${id}`}
            </Heading>
            <ModalCloseButton onClick={rootProps.onClose} />
        </ModalHeader>

        <ModalContent>
            <Paragraph>{`ID: ${id}`}</Paragraph>
            <TextInput
                placeholder="Rename to"
                spellCheck={false}
                value={rename}
                onChange={async e => {
                    customIDtoName.set(id, e);
                    cleanAndStoreMappings(false);
                    updater(e);
                }}
            />
        </ModalContent>
    </ModalRoot>);
}


const settings = definePluginSettings({
    mappings: {
        description: "Mapping of unknown server/channel IDs to names",
        type: OptionType.COMPONENT,
        component: () => <CustomIDMappingSettings />
    },
    mappingsJSON: {
        description: "JSON.stringify(mappings)",
        type: OptionType.STRING,
        default: "[]",
        hidden: true,
    }
});

export default definePlugin({
    name: "attachmentSnowflakeInfo",
    description: "Display information parsed from Discord CDN links for embeds and links",
    authors: [{ name: "dash", id: 548007774840160260n }],
    dependencies: ["MessageAccessoriesAPI"],
    settings,

    async start() {
        customIDtoName = new Map(JSON.parse(settings.store.mappingsJSON));
        addMessageAccessory("attachment-snowflake-info", (props: Record<string, any>) => {
            const elements = getAttachments(props.message).map((element: Attachment, index: number) => {
                return (
                    <div key={index}>
                    {this.createFooter(element.name, element.channel, element.snowflake)}
                    </div>
                );
            });
            return (<div>{elements}</div>);
        }, 2);
    },

    createFooter(name: string, channel_id: string, snowflake: string) {
        const channel = ChannelStore.getChannel(channel_id);
        const guild_id = channel?.guild_id;

        const promptRename = (id: string) => {
            openModal(props => (<RenameModal rootProps={props} id={id} value={customIDtoName.get(id) ?? ""} />));
        };
        const createRenameableID = (id: string, fallback: string) => {
            return <Paragraph className={cl("footer-element")} onClick={() => promptRename(id)}>{(() => {
                const name = (customIDtoName.get(id) ?? "").trim();
                if (name.length !== 0) {
                    return `"${name}" (set by user)`;
                }
                return fallback;
            })()}</Paragraph>;
        };

        const jumper = channel ? () => NavigationRouter.transitionTo(`/channels/${guild_id ?? "@me"}/${channel_id}/${snowflake}`) : undefined;

        return <div className={cl("footer")} onClick={jumper}>
            <Paragraph className={cl("footer-element")}>"{name}"</Paragraph>
            <Paragraph className={cl("footer-element")}> in </Paragraph>
            {<>
                {
                    channel ? <Paragraph className={cl("footer-element")}>{(() => {
                            /*
                                - Text channel
                                - Voice channel
                                - Announcement channel
                                - Stage channel
                                - Forum channel
                                - Media channel
                            */
                            if ([0, 2, 5, 13, 15, 16].includes(channel.type)) return `#${channel.name}`;
                            // DMs
                            if (channel.type === 1) return `@${(() => {
                                const user = UserStore.getUser(channel.recipients[0]);
                                return user.globalName || user.username;
                            })()}`;
                            // GDMs
                            if (channel.type === 3) return channel.name || (() => {
                                const users = channel.recipients.map(r => UserStore.getUser(r));
                                return users.map(u => u.globalName || u.username).join(", ");
                            })();
                            // Threads
                            if ([10, 11, 12].includes(channel.type)) return `#${channel.name}`;
                        })()}
                    </Paragraph> : createRenameableID(channel_id, `<#${channel_id}>`)
                }
                <Paragraph className={cl("footer-element")}> uploaded: </Paragraph>
            </>}
            <Paragraph className={cl("footer-element")}>
                {this.getPreciseTimestamp(snowflake)}
            </Paragraph>
        </div>;
    },
    getPreciseTimestamp(snowflake: string) {
        return DateUtils.calendarFormat(new Date(SnowflakeUtils.extractTimestamp(snowflake)));
    },
});
