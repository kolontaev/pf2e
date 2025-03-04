import { ActorType } from "@actor/data";
import { ItemPF2e } from "@item";
import { ItemSourcePF2e } from "@item/data";
import { ItemGrantDeleteAction } from "@item/data/base";
import { MigrationList, MigrationRunner } from "@module/migration";
import { isObject, sluggify, tupleHasValue } from "@util";
import { REPreCreateParameters, REPreDeleteParameters, RuleElementPF2e, RuleElementSource } from "..";
import { RuleElementOptions } from "../base";
import { ChoiceSetSource } from "../choice-set/data";
import { ChoiceSetRuleElement } from "../choice-set/rule-element";

class GrantItemRuleElement extends RuleElementPF2e {
    static override validActorTypes: ActorType[] = ["character", "npc", "familiar"];

    /** The UUID of the item to grant: must be a compendium or world item */
    uuid: string;
    /** Whether the granted item should replace the granting item */
    protected replaceSelf: boolean;
    /** Permit this grant to be applied during an actor update--if it isn't already granted and the predicate passes */
    protected reevaluateOnUpdate: boolean;
    /** Allow multiple of the same item (as determined by source ID) to be granted */
    protected allowDuplicate: boolean;
    /**
     * If the granted item has a `ChoiceSet`, its selection may be predetermined. The key of the record must be the
     * `ChoiceSet`'s designated `flag` property.
     */
    preselectChoices: Record<string, string | number>;

    constructor(data: GrantItemSource, item: Embedded<ItemPF2e>, options?: RuleElementOptions) {
        super(data, item, options);

        this.uuid = String(data.uuid);
        this.replaceSelf = Boolean(data.replaceSelf ?? false);
        this.reevaluateOnUpdate = Boolean(data.reevaluateOnUpdate ?? false);
        this.allowDuplicate = Boolean(data.allowDuplicate ?? true);

        const isValidPreselect = (p: Record<string, unknown>): p is Record<string, string | number> =>
            Object.values(p).every((v) => ["string", "number"].includes(typeof v));
        this.preselectChoices =
            isObject<string>(data.preselectChoices) && isValidPreselect(data.preselectChoices)
                ? deepClone(data.preselectChoices)
                : {};
    }

    override async preCreate(args: Omit<REPreCreateParameters, "ruleSource">): Promise<void> {
        if (!this.test()) return;

        const { itemSource, pendingItems, context } = args;

        const uuid = this.resolveInjectedProperties(this.uuid);
        const grantedItem: ClientDocument | null = await (async () => {
            try {
                return await fromUuid(uuid);
            } catch (error) {
                console.error(error);
                return null;
            }
        })();
        if (!(grantedItem instanceof ItemPF2e)) return;

        // If we shouldn't allow duplicates, check for an existing item with this source ID
        if (!this.allowDuplicate && this.actor.items.some((i) => i.sourceId === uuid)) {
            if (this.replaceSelf) {
                pendingItems.splice(pendingItems.indexOf(itemSource), 1);
            }
            ui.notifications.info(
                game.i18n.format("PF2E.UI.RuleElements.GrantItem.AlreadyHasItem", {
                    actor: this.actor.name,
                    item: grantedItem.name,
                })
            );
            return;
        }

        // Set ids and flags on the granting and granted items
        itemSource._id ??= randomID();
        const grantedSource = grantedItem.toObject();
        grantedSource._id = randomID();

        // Guarantee future alreadyGranted checks pass in all cases by re-assigning sourceId
        grantedSource.flags = mergeObject(grantedSource.flags, { core: { sourceId: uuid } });

        // The grant may have come from a non-system compendium, so make sure it's fully migrated
        const migrations = MigrationList.constructFromVersion(grantedSource.data.schema.version ?? 0);
        if (migrations.length > 0) {
            const actorWithNewItem = this.actor.toObject();
            actorWithNewItem.items.push(grantedSource);
            for (const migration of migrations) {
                await migration.updateItem(grantedSource, actorWithNewItem);
            }
            grantedSource.data.schema.version = MigrationRunner.LATEST_SCHEMA_VERSION;
        }

        // Create a temporary owned item and run its actor-data preparation and early-stage rule-element callbacks
        const tempGranted = new ItemPF2e(grantedSource, { parent: this.actor }) as Embedded<ItemPF2e>;
        tempGranted.prepareActorData?.();
        for (const rule of tempGranted.prepareRuleElements({ suppressWarnings: true })) {
            rule.onApplyActiveEffects?.();
        }

        this.applyChoiceSelections(tempGranted);

        // Set the self:class and self:feat(ure) roll option for predication from subsequent pending items
        for (const item of [this.item, tempGranted]) {
            if (item.isOfType("class", "feat")) {
                const prefix = item.isOfType("class") || !item.isFeature ? item.type : "feature";
                const slug = item.slug ?? sluggify(item.name);
                this.actor.rollOptions.all[`self:${prefix}:${slug}`] = true;
            }
        }

        // If the granted item is replacing the granting item, swap it out and return early
        if (this.replaceSelf) {
            pendingItems.findSplice((i) => i === itemSource, grantedSource);
            await this.runGrantedItemPreCreates(args, tempGranted);
            return;
        }

        context.keepId = true;

        // The granting item records the granted item's ID in an array at `flags.pf2e.itemGrants`
        const flags = mergeObject(itemSource.flags ?? {}, { pf2e: {} });
        flags.pf2e.itemGrants ??= [];
        flags.pf2e.itemGrants.push({ id: grantedSource._id });

        // The granted item records its granting item's ID at `flags.pf2e.grantedBy`
        const grantedFlags = mergeObject(grantedSource.flags ?? {}, { pf2e: {} });
        grantedFlags.pf2e.grantedBy = { id: itemSource._id };

        // Run the granted item's preCreate callbacks
        await this.runGrantedItemPreCreates(args, tempGranted);

        pendingItems.push(grantedSource);
    }

    /** Grant an item if this rule element permits it and the predicate passes */
    override async preUpdateActor(): Promise<void> {
        if (!this.reevaluateOnUpdate) return;

        const uuid = this.resolveInjectedProperties(this.uuid);
        const alreadyGranted = this.item.data.flags.pf2e.itemGrants.some(
            (g) => this.actor.items.get(g.id)?.sourceId === uuid
        );
        if (alreadyGranted) return;

        // A granted item can't replace its granter when done on actor update
        this.replaceSelf = false;

        const itemSource = this.item.toObject();
        const pendingItems: ItemSourcePF2e[] = [];
        const context = { parent: this.actor, render: false };
        await this.preCreate({ itemSource, pendingItems, context });

        if (pendingItems.length > 0) {
            const updatedGrants = itemSource.flags.pf2e?.itemGrants ?? [];
            await this.item.update({ "flags.pf2e.itemGrants": updatedGrants }, { render: false });
            await this.actor.createEmbeddedDocuments("Item", pendingItems, context);
        }
    }

    override async preDelete({ pendingItems }: REPreDeleteParameters): Promise<void> {
        const grants = this.item.data.flags.pf2e.itemGrants ?? [];
        const DELETE_ACTIONS = ["cascade", "detach", "restrict"] as const;

        const deletionActions = grants.reduce(
            (actions: Record<ItemGrantDeleteAction, Embedded<ItemPF2e>[]>, grant) => {
                const item = this.actor.items.get(grant.id);
                const { grantedBy } = item?.data.flags.pf2e ?? {};
                if (!(item && grantedBy && tupleHasValue(DELETE_ACTIONS, grantedBy.onDelete))) {
                    return actions;
                }
                actions[grantedBy.onDelete].push(item);

                return actions;
            },
            { cascade: [], detach: [], restrict: [] }
        );

        // If any granted item prevents this item's deletion, notify the user and exit early
        const restrictedBy = deletionActions.restrict.shift();
        if (restrictedBy) {
            ui.notifications.warn(`Removal of ${this.item.name} is prevented by ${restrictedBy.name}.`);
            pendingItems.splice(pendingItems.indexOf(this.item), 1);
            return;
        }

        // Unset the grant flag for any grant that is to detach upon granter's deletion
        await this.actor.updateEmbeddedDocuments(
            "Item",
            deletionActions.detach.map((i) => ({ _id: i.id, "data.flags.pf2e.-=grantedBy": null })),
            { render: false }
        );

        // Include any grant in the deletions if the granter's own deletion is to cascade
        pendingItems.push(...deletionActions.cascade);
    }

    private applyChoiceSelections(grantedItem: Embedded<ItemPF2e>): void {
        const source = grantedItem.data._source;
        for (const [flag, selection] of Object.entries(this.preselectChoices ?? {})) {
            const rule = grantedItem.rules.find(
                (rule): rule is ChoiceSetRuleElement => rule instanceof ChoiceSetRuleElement && rule.data.flag === flag
            );
            if (rule) {
                const ruleSource = source.data.rules[grantedItem.rules.indexOf(rule)] as ChoiceSetSource;
                const resolvedSelection =
                    typeof selection === "string" ? this.resolveInjectedProperties(selection) : selection;
                rule.data.selection = ruleSource.selection = resolvedSelection;
            }
        }
    }

    /** Run the preCreate callbacks of REs from the granted item */
    private async runGrantedItemPreCreates(
        originalArgs: Omit<REPreCreateParameters, "ruleSource">,
        grantedItem: Embedded<ItemPF2e>
    ): Promise<void> {
        // Create a temporary embedded version of the item to run its pre-create REs
        if (grantedItem.data.data.rules) {
            const grantedSource = grantedItem.data._source;
            for await (const rule of grantedItem.rules) {
                const ruleSource = grantedSource.data.rules[grantedItem.rules.indexOf(rule)] as RuleElementSource;
                await rule.preCreate?.({
                    ...originalArgs,
                    itemSource: grantedSource,
                    ruleSource,
                });
            }
        }
    }
}

interface GrantItemSource extends RuleElementSource {
    uuid?: unknown;
    replaceSelf?: unknown;
    preselectChoices?: unknown;
    reevaluateOnUpdate?: unknown;
    allowDuplicate?: unknown;
}

export { GrantItemRuleElement, GrantItemSource };
