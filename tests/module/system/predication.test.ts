import { PredicatePF2e } from "@system/predication";

describe("Predication with atomics return correct results", () => {
    test("atomics with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: ["foo", "bar", "baz"] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["foo", "bar"])).toEqual(false);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(true);
    });

    test("atomics with the `any` quantifier", () => {
        const predicate = new PredicatePF2e({ any: ["foo", "bar", "baz"] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test(["foo", "bar"])).toEqual(true);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(false);
    });

    test("atomics with the `none` quantifier", () => {
        const predicate = new PredicatePF2e({ not: ["foo", "bar", "baz"] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["foo", "bar"])).toEqual(false);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(true);
        expect(predicate.test(["bat"])).toEqual(true);
    });
});

describe("Predication with conjunction and negation return correct results", () => {
    test("conjunction with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: [{ and: ["foo", "bar", "baz"] }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["foo", "bar"])).toEqual(false);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(false);
        expect(predicate.test(["baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
    });

    test("conjunction and negation with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: [{ and: ["foo", "bar", { not: "baz" }] }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["foo", "bar"])).toEqual(true);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(false);
        expect(predicate.test(["baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
    });

    test("conjunction with the `any` quantifier", () => {
        const predicate = new PredicatePF2e({ any: ["foo", { and: ["bar", "baz"] }] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test(["foo", "bar"])).toEqual(true);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(true);
        expect(predicate.test(["bar"])).toEqual(false);
        expect(predicate.test(["baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
    });

    test("conjunction and negation with the `none` quantifier", () => {
        const predicate = new PredicatePF2e({ not: ["foo", { and: ["bar", "baz"] }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["bar"])).toEqual(true);
        expect(predicate.test(["baz"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(false);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(false);
    });
});

describe("Predication with disjunction and negation return correct results", () => {
    test("disjunction with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: [{ or: ["foo", "bar", "baz"] }] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test(["foo", "bar"])).toEqual(true);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(true);
        expect(predicate.test(["baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(false);
    });

    test("disjunction and negation with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: [{ or: ["foo", "bar", { not: "baz" }] }] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test(["bar", "bar"])).toEqual(true);
        expect(predicate.test(["foo", "bar"])).toEqual(true);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(true);
        expect(predicate.test(["baz"])).toEqual(false);
        expect(predicate.test(["baz", "bat"])).toEqual(false);
        expect(predicate.test([])).toEqual(true);
    });

    test("disjunction with the `any` quantifier", () => {
        // same as { any: ["foo", "bar", "baz"] };
        const predicate = new PredicatePF2e({ any: ["foo", { or: ["bar", "baz"] }] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test(["foo", "bar"])).toEqual(true);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(true);
        expect(predicate.test(["bar"])).toEqual(true);
        expect(predicate.test(["baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(false);
    });

    test("disjunction with the `none` quantifier", () => {
        // same as { not: ["foo", "bar", "baz"] };
        const predicate = new PredicatePF2e({ not: [{ or: ["foo", "bar", "baz"] }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["foo", "bar"])).toEqual(false);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(true);
    });
});

describe("Predication with joint denial return correct results", () => {
    test("joint denial with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: [{ nor: ["foo", "bar", "baz"] }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["foo", "bar"])).toEqual(false);
        expect(predicate.test(["foo", "bar", "baz"])).toEqual(false);
        expect(predicate.test(["bar", "baz"])).toEqual(false);
        expect(predicate.test(["baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(true);
        expect(predicate.test(["bat"])).toEqual(true);
    });

    test("joint denial is equivalent to negated disjunction", () => {
        const joinDenial = new PredicatePF2e({ all: [{ nor: ["foo", "bar"] }] });
        const negatedDisjunction = new PredicatePF2e({ all: [{ not: { or: ["foo", "bar"] } }] });
        expect(joinDenial.test(["foo"])).toEqual(negatedDisjunction.test(["foo"]));
        expect(joinDenial.test(["foo", "bar"])).toEqual(negatedDisjunction.test(["foo", "bar"]));
        expect(joinDenial.test(["foo", "bar", "baz"])).toEqual(negatedDisjunction.test(["foo", "bar", "baz"]));
        expect(joinDenial.test(["baz"])).toEqual(negatedDisjunction.test(["baz"]));
        expect(joinDenial.test(["baz", "bat"])).toEqual(negatedDisjunction.test(["baz", "bat"]));
        expect(joinDenial.test([])).toEqual(negatedDisjunction.test([]));
    });
});

describe("Predication with material conditional and negation return correct results", () => {
    test("material conditional with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: [{ if: "foo", then: "bar" }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test(["foo", "bar"])).toEqual(true);
        expect(predicate.test(["bar"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(true);
    });

    test("material conditional and negation with the `all` quantifier", () => {
        const predicate = new PredicatePF2e({ all: [{ if: "foo", then: { not: "bar" } }] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test(["foo", "bar"])).toEqual(false);
        expect(predicate.test(["bar"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(true);
    });

    test("material conditional and negation with the `any` quantifier", () => {
        const predicate = new PredicatePF2e({
            any: [
                { if: "foo", then: { not: "bar" } },
                { if: "bar", then: { not: "foo" } },
            ],
        });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test(["foo", "bar"])).toEqual(false);
        expect(predicate.test(["bar"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(true);
    });
});

describe("Tautological propositions pass all predicate tests", () => {
    test("p or not p", () => {
        const predicate = new PredicatePF2e({ all: [{ or: ["foo", { not: "foo" }] }] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test([])).toEqual(true);
        expect(predicate.test(["bar"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(true);
    });

    test("if p then p", () => {
        const predicate = new PredicatePF2e({ all: [{ if: "foo", then: "foo" }] });
        expect(predicate.test(["foo"])).toEqual(true);
        expect(predicate.test([])).toEqual(true);
        expect(predicate.test(["bar"])).toEqual(true);
        expect(predicate.test(["bar", "baz"])).toEqual(true);
        expect(predicate.test([])).toEqual(true);
    });
});

describe("Contradictory propositions fail all predicate tests", () => {
    test("p and not p", () => {
        const predicate = new PredicatePF2e({ all: ["foo", { not: "foo" }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
        expect(predicate.test(["bar"])).toEqual(false);
        expect(predicate.test(["bar", "baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
    });

    test("p; if p then not p", () => {
        const predicate = new PredicatePF2e({ all: ["foo", { if: "foo", then: { not: "foo" } }] });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
        expect(predicate.test(["bar"])).toEqual(false);
        expect(predicate.test(["bar", "baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
    });

    test("p; if p then q; if q then not p", () => {
        const predicate = new PredicatePF2e({
            all: ["foo", { if: "foo", then: "bar" }, { if: "bar", then: { not: "foo" } }],
        });
        expect(predicate.test(["foo"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
        expect(predicate.test(["bar"])).toEqual(false);
        expect(predicate.test(["bar", "baz"])).toEqual(false);
        expect(predicate.test([])).toEqual(false);
    });
});