import { getStatesDescriptions } from "@statewalker/fsm-charts";

export function prepareStateDescriptions({
  element,
  rootStateKey,
  titleElementName = "strong",
}: {
  element: HTMLElement;
  rootStateKey: string;
  // No title if undefined or empty string
  titleElementName?: string;
}): (statesStack: string[]) => undefined | Node {
  const descriptions = getStatesDescriptions({
    element,
    rootStateKey,
  });
  return (statesStack: string[]) => {
    const state = [...statesStack].pop();
    if (!state) return;
    const section = descriptions[state];
    if (!section) return;
    const content = document.createDocumentFragment();
    const title = (section.title ?? "").trim();
    if (title && titleElementName) {
      const headerText = document.createElement(titleElementName);
      content.append(headerText);
      headerText.textContent = title;
    }
    for (const node of section.content) {
      if (node.nodeName[0] === "#") continue;
      content.append(node.cloneNode(true));
    }
    return content;
  };
}
