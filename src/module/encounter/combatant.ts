import type { ActorPF2e } from "@actor/base";
import { ErrorPF2e } from "@util";
import { EncounterPF2e } from ".";

class CombatantPF2e<TActor extends ActorPF2e | null = ActorPF2e | null> extends Combatant<TActor> {
    get encounter() {
        return this.parent;
    }

    get defeated(): boolean {
        return this.data.defeated;
    }

    /** Can the user see this combatant's name? */
    get playersCanSeeName(): boolean {
        return !!this.token?.playersCanSeeName;
    }

    overridePriority(initiative: number): number | null {
        return this.data.flags.pf2e.overridePriority[initiative] ?? null;
    }

    hasHigherInitiative(this: RolledCombatant, { than }: { than: RolledCombatant }): boolean {
        if (this.parent !== than.parent) {
            throw ErrorPF2e("The initiative of Combatants from different combats cannot be compared");
        }

        return this.parent.getCombatantWithHigherInit(this, than) === this;
    }

    override prepareBaseData(): void {
        super.prepareBaseData();

        this.data.flags.pf2e = mergeObject(this.data.flags.pf2e ?? {}, { overridePriority: {} });
    }

    /** Toggle the defeated status of this combatant, applying or removing the overlay icon on its token */
    async toggleDefeated(): Promise<void> {
        await this.update({ defeated: !this.defeated });
        await this.token?.object.toggleEffect(game.settings.get("pf2e", "deathIcon"), { overlay: true });
    }

    /**
     * Hide the tracked resource if the combatant represents a non-player-owned actor
     * @todo Make this a configurable with a metagame-knowledge setting
     */
    override updateResource(): { value: number } | null {
        if (this.isNPC && !game.user.isGM) return (this.resource = null);
        return super.updateResource();
    }

    override _getInitiativeFormula(): string {
        const { actor } = this;
        if (!actor) return "1d20";
        const actorData = actor.data;
        let bonus = 0;

        if (actorData.type === "hazard") {
            bonus = actorData.data.attributes.stealth.value;
        } else if (
            "initiative" in actorData.data.attributes &&
            "totalModifier" in actorData.data.attributes.initiative
        ) {
            bonus = actorData.data.attributes.initiative.totalModifier;
        } else if ("perception" in actorData.data.attributes) {
            bonus = actorData.data.attributes.perception.value;
        }

        const parts = ["1d20", bonus || 0];

        return parts.join("+");
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** Toggle the visibility of names to players */
    async toggleNameVisibility(): Promise<void> {
        if (!this.token) return;

        const currentVisibility = this.token.data.displayName;

        const visibilityToggles = {
            [CONST.TOKEN_DISPLAY_MODES.ALWAYS]: CONST.TOKEN_DISPLAY_MODES.OWNER,
            [CONST.TOKEN_DISPLAY_MODES.CONTROL]: CONST.TOKEN_DISPLAY_MODES.HOVER,
            [CONST.TOKEN_DISPLAY_MODES.HOVER]: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
            [CONST.TOKEN_DISPLAY_MODES.NONE]: CONST.TOKEN_DISPLAY_MODES.HOVER,
            [CONST.TOKEN_DISPLAY_MODES.OWNER]: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
            [CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER]: CONST.TOKEN_DISPLAY_MODES.HOVER,
        };

        await this.token.update({ displayName: visibilityToggles[currentVisibility] });
    }
}

type CombatantDataPF2e<T extends CombatantPF2e> = foundry.data.CombatantData<T> & {
    flags: {
        pf2e: {
            overridePriority: Record<number, number | undefined>;
        };
    };
};

interface CombatantPF2e<TActor extends ActorPF2e | null = ActorPF2e | null> extends Combatant<TActor> {
    readonly parent: EncounterPF2e | null;

    readonly data: CombatantDataPF2e<this>;
}

type RolledCombatant = Embedded<CombatantPF2e> & { get initiative(): number };

export { CombatantPF2e, RolledCombatant };