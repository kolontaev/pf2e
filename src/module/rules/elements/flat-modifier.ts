import { RuleElementPF2e } from "../rule-element";
import { RuleElementData, RuleElementSource, RuleElementSynthetics } from "../rules-data-definitions";
import { ModifierPF2e, ModifierType, MODIFIER_TYPE, MODIFIER_TYPES } from "@module/modifiers";
import { AbilityString, ActorType } from "@actor/data";
import { ItemPF2e } from "@item";
import { tupleHasValue } from "@util";
import { ABILITY_ABBREVIATIONS } from "@actor/data/values";

/**
 * Apply a constant modifier (or penalty/bonus) to a statistic or usage thereof
 * @category RuleElement
 */
class FlatModifierRuleElement extends RuleElementPF2e {
    protected static override validActorTypes: ActorType[] = ["character", "familiar", "npc"];

    constructor(data: FlatModifierSource, item: Embedded<ItemPF2e>) {
        super(data, item);

        const modifierTypes: readonly unknown[] = MODIFIER_TYPES;
        this.data.type ??= MODIFIER_TYPE.UNTYPED;
        if (!modifierTypes.includes(this.data.type)) {
            this.failValidation(`A flat modifier must have one of the following types: ${MODIFIER_TYPES.join(", ")}`);
            return;
        }
        if (this.data.type === "ability") {
            if (!tupleHasValue(ABILITY_ABBREVIATIONS, data.ability)) {
                this.failValidation(
                    'A flat modifier of type "ability" must also have an "ability" property with an ability abbreviation'
                );
                return;
            }
            this.data.name = CONFIG.PF2E.abilities[this.data.ability];
            this.data.value = `@abilities.${this.data.ability}.mod`;
        }
    }

    override onBeforePrepareData({ statisticsModifiers }: RuleElementSynthetics) {
        if (this.ignored) return;

        const selector = this.resolveInjectedProperties(this.data.selector);
        const resolvedValue = this.resolveValue(this.data.value);
        const value = Math.clamped(resolvedValue, this.data.min ?? resolvedValue, this.data.max ?? resolvedValue);
        if (selector && value) {
            const modifier = new ModifierPF2e(this.data.name ?? this.label, value, this.data.type);
            modifier.label = this.label;
            if (this.data.type === "ability") {
                modifier.ability = this.data.ability;
            }
            if (this.data.damageType) {
                modifier.damageType = this.resolveInjectedProperties(this.data.damageType);
            }
            if (this.data.damageCategory) {
                modifier.damageCategory = this.data.damageCategory;
            }
            if (this.data.predicate) {
                modifier.predicate = this.data.predicate;
            }
            statisticsModifiers[selector] = (statisticsModifiers[selector] || []).concat(modifier);
        } else if (value === 0) {
            // omit modifiers with a value of zero
        } else if (CONFIG.debug.ruleElement) {
            console.warn(
                "PF2E | Flat modifier requires at least a selector field, a label field or item name, and a value field",
                this.data,
                this.item,
                this.actor.data
            );
        }
    }
}

interface FlatModifierRuleElement {
    data: FlatModifierData;
}

interface FlatModifierSource extends RuleElementSource {
    name?: unknown;
    min?: unknown;
    max?: unknown;
    type?: unknown;
    ability?: unknown;
    damageType?: unknown;
    damageCategory?: unknown;
}

type FlatModifierData = FlatAbilityModifierData | FlatOtherModifierData;

interface BaseFlatModifierData extends RuleElementData {
    name?: string;
    min?: number;
    max?: number;
    type: ModifierType;
    damageType?: string;
    damageCategory?: string;
}

interface FlatAbilityModifierData extends BaseFlatModifierData {
    type: "ability";
    ability: AbilityString;
}

interface FlatOtherModifierData extends Exclude<BaseFlatModifierData, "type"> {
    type: Exclude<ModifierType, "ability">;
}

export { FlatModifierRuleElement };