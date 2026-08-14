import {
  buildSections,
  type DomSection,
  findSection,
  visitSectionNodes,
  vistSections,
} from "./buildSections.js";

export type StateDescriptionSection = DomSection & {
  state: string;
  title?: string;
};
export function* visitStateDescriptions({
  element,
  rootStateKey,
  removeFromDom = true,
  splitHeader = (
    header?: HTMLElement,
  ): [stateKey: undefined | string, label: string] => {
    if (!header) return [undefined, ""];
    const text = header.innerText.trim();
    let key: string | undefined;
    let label: string = text;
    text.replace(/^\s*\[(.*)\]\s*(.*)$/, (_, k, l) => {
      key = k.trim();
      label = l.trim() || key;
      return "";
    });
    return [key, label];
  },
}: {
  element: HTMLElement;
  rootStateKey: string;
  removeFromDom?: boolean; // If true - removes state description nodes from the DOM
  splitHeader?: (
    header?: HTMLElement,
  ) => [stateKey: undefined | string, label: string];
}): Generator<StateDescriptionSection> {
  const docSections = buildSections(element);
  const rootDescription = findSection(docSections, (section: DomSection) => {
    if (!section.header) return false;
    const [key] = splitHeader(section.header);
    return key === rootStateKey;
  });
  if (!rootDescription) return;

  // Remove description nodes from DOM
  if (removeFromDom) {
    for (const node of visitSectionNodes(rootDescription)) {
      if (node.nodeName[0] === "#") continue;
      node.parentElement?.removeChild(node);
    }
  }

  for (const section of vistSections(rootDescription, false)) {
    if (!section.header) continue;
    const [state, title] = splitHeader(section.header);
    if (state)
      yield {
        state,
        title,
        ...section,
      };
  }
}

export function getStatesDescriptions(options: {
  element: HTMLElement;
  rootStateKey: string;
  removeFromDom?: boolean; // If true - removes state description nodes from the DOM
  splitHeader?: (
    header?: HTMLElement,
  ) => [stateKey: undefined | string, label: string];
}): { [state: string]: StateDescriptionSection } {
  const index: { [state: string]: StateDescriptionSection } = {};
  for (const description of visitStateDescriptions(options)) {
    index[description.state] = description;
  }
  return index;
}
