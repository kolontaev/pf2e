import { ItemPF2e } from "@item/base";
import { MeleeData, NPCAttackTrait } from "./data";

export class MeleePF2e extends ItemPF2e {
    get traits(): Set<NPCAttackTrait> {
        return new Set(this.data.data.traits.value);
    }

    override getChatData(this: Embedded<MeleePF2e>, htmlOptions: EnrichHTMLOptions = {}): Record<string, unknown> {
        const data = this.data.data;
        const traits = this.traitChatData(CONFIG.PF2E.weaponTraits);

        const isAgile = this.traits.has("agile");
        const map2 = isAgile ? "-4" : "-5";
        const map3 = isAgile ? "-8" : "-10";

        return this.processChatData(htmlOptions, { ...data, traits, map2, map3 });
    }
}

export interface MeleePF2e {
    readonly data: MeleeData;
}
