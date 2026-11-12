import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The package barrel imports itself; take the real helper from the module that defines it.
vi.mock("@openimis/fe-core", async () => {
  const modules = await vi.importActual("../../helpers/modules");
  return { withModulesManager: modules.default };
});

const { default: NumberInput } = await import("./NumberInput");
const { default: AmountInput } = await import("./AmountInput");
const { mockModulesManager, renderWithProviders, userEvent } = await import("../../testing");

const modulesManagerFor = (thousandSeparator) =>
  mockModulesManager({
    getConf: (module, key, defaultValue) =>
      key === "thousandSeparator" && thousandSeparator !== undefined ? thousandSeparator : defaultValue,
  });

// Keeps the last emitted value as the prop, like a form does.
function Controlled({ Component = NumberInput, initial, emitted, ...props }) {
  const [value, setValue] = React.useState(initial);
  return (
    <Component
      {...props}
      value={value}
      onChange={(v) => {
        emitted.push(v);
        setValue(v);
      }}
    />
  );
}

const input = () => document.querySelector("input");
const shown = () => input().value.replace(/\s/g, " ");

const typeAndRead = async (locale, text, props = {}, Component = NumberInput) => {
  const emitted = [];
  renderWithProviders(<Controlled Component={Component} initial={undefined} emitted={emitted} {...props} />, {
    modulesManager: modulesManagerFor(locale),
  });
  const user = userEvent.setup();
  if (text === "") {
    await user.type(input(), "5");
    await user.clear(input());
  } else {
    await user.type(input(), text);
  }
  return emitted[emitted.length - 1];
};

// [typed text, value emitted once the whole text is typed]
const FRENCH = [
  ["1500", 1500],
  ["1 500", 1500],
  ["1.500", 1.5],
  ["1,500", 1.5],
  ["1,5", 1.5],
  ["1.5", 1.5],
  ["0,5", 0.5],
  ["0,015", 0.015],
  ["0,125", 0.125],
  [",5", 0.5],
  ["-3", -3],
  ["72000", 72000],
  ["72,000", 72],
  ["72.000", 72],
  ["1 500,5", 1500.5],
  ["1.234.567,89", 1234567.89],
  ["1 234 567,89", 1234567.89],
  ["1 234 567,89", 1234567.89],
  ["1 500,5", 1500.5],
  ["", undefined],
];

// Unchanged behaviour of a locale whose decimal separator is a dot (the default).
const ENGLISH = [
  ["1500", 1500],
  ["1 500", 1500],
  ["1.500", 1.5],
  ["1,500", 1500],
  ["1,5", 1.5],
  ["1.5", 1.5],
  ["0,5", 0.5],
  ["0,015", 15],
  ["0,125", 125],
  [",5", 0.5],
  ["-3", -3],
  ["72000", 72000],
  ["72,000", 72000],
  ["72.000", 72],
  ["", undefined],
];

beforeEach(() => {
  // TextInput leaks props onto the DOM, so React warns on every render.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("FormattedNumberInput parsing", () => {
  describe.each([
    ["fr", FRENCH],
    ["de", [["1.234,5", 1234.5], ["1,5", 1.5], ["1.234.567", 1234567], ["72,000", 72]]],
  ])("locale %s", (locale, rows) => {
    it.each(rows)("%j gives %j (NumberInput)", async (text, expected) => {
      expect(await typeAndRead(locale, text)).toBe(expected);
    });

    it.each(rows)("%j gives %j (numberOfDecimals=2)", async (text, expected) => {
      expect(await typeAndRead(locale, text, { numberOfDecimals: 2 })).toBe(expected);
    });

    it.each(rows)("%j gives %j (AmountInput)", async (text, expected) => {
      expect(await typeAndRead(locale, text, {}, AmountInput)).toBe(expected);
    });
  });

  describe.each([["default", undefined], ["en", "en"]])("locale %s", (_, locale) => {
    it.each(ENGLISH)("%j gives %j (NumberInput)", async (text, expected) => {
      expect(await typeAndRead(locale, text)).toBe(expected);
    });

    it.each(ENGLISH)("%j gives %j (numberOfDecimals=2)", async (text, expected) => {
      expect(await typeAndRead(locale, text, { numberOfDecimals: 2 })).toBe(expected);
    });

    it.each(ENGLISH)("%j gives %j (AmountInput)", async (text, expected) => {
      expect(await typeAndRead(locale, text, {}, AmountInput)).toBe(expected);
    });
  });
});

describe("FormattedNumberInput display and in-place editing under fr", () => {
  const edit = async (props, keys, Component = NumberInput) => {
    const emitted = [];
    renderWithProviders(<Controlled Component={Component} emitted={emitted} {...props} />, {
      modulesManager: modulesManagerFor("fr"),
    });
    const user = userEvent.setup();
    const before = shown();
    await user.click(input());
    if (keys) await user.keyboard(keys);
    const during = shown();
    await user.tab();
    return { before, during, after: shown(), emitted };
  };

  it("shows the stored value with French grouping and decimals", () => {
    renderWithProviders(<NumberInput value={72000} onChange={() => {}} />, { modulesManager: modulesManagerFor("fr") });
    expect(shown()).toBe("72 000");
  });

  it("appends a digit to a grouped integer", async () => {
    const { before, emitted } = await edit({ initial: 72000 }, "{End}0");
    expect(before).toBe("72 000");
    expect(emitted).toEqual([720000]);
  });

  it("deletes the last digit of a grouped integer", async () => {
    const { emitted } = await edit({ initial: 72000 }, "{End}{Backspace}");
    expect(emitted).toEqual([7200]);
  });

  it("leaves a grouped integer alone when it is only focused and left", async () => {
    const { before, after, emitted } = await edit({ initial: 72000 }, null);
    expect(after).toBe(before);
    expect(emitted).toEqual([]);
  });

  it("appends a digit to an amount with decimals", async () => {
    const { before, emitted } = await edit({ initial: 1500, numberOfDecimals: 2 }, "{End}0");
    expect(before).toBe("1 500,00");
    expect(emitted[emitted.length - 1] ?? 1500).toBe(1500);
  });

  it("deletes the last digit of an amount with decimals", async () => {
    const { emitted } = await edit({ initial: 1500, numberOfDecimals: 2 }, "{End}{Backspace}");
    expect(emitted[emitted.length - 1] ?? 1500).toBe(1500);
  });

  it("leaves an amount with decimals alone when it is only focused and left", async () => {
    const { before, after, emitted } = await edit({ initial: 72000, Component: AmountInput }, null, AmountInput);
    expect(before).toBe("72 000,00");
    expect(after).toBe(before);
    expect(emitted).toEqual([]);
  });

  it("keeps the fractional part of a stored value", async () => {
    const { before, emitted } = await edit({ initial: 1.5, numberOfDecimals: 2 }, "{End}5");
    expect(before).toBe("1,50");
    expect(emitted[emitted.length - 1]).toBe(1.505);
  });
});
