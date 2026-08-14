import type { DomSection } from "./buildSections.js";
import { getStatesDescriptions } from "./getStatesDescriptions.js";

export function getStateDescriptionRenderer(options: {
  element: HTMLElement;
  rootStateKey: string;
  splitHeader?: (
    header?: HTMLElement,
  ) => [stateKey: undefined | string, label: string];
}) {
  const descriptionsIndex = getStatesDescriptions(options);

  return (statesStack: string[]) => {
    const stateKey: string | undefined = [...statesStack].pop();
    if (!stateKey) return;

    const section = descriptionsIndex[stateKey];
    if (!section) return;

    const elm = renderSections({
      section,
      deep: (_section) => false, // section.state !== options.rootStateKey, // ???
      header: (section) => {
        if (section.state === stateKey) {
          return section.title || section.state;
        }
        return;
      },
    });
    const details = elm?.querySelector("details");
    details && (details.open = true);
    return elm;
  };
}

export function renderSections<T extends DomSection>({
  section,
  deep = (_s) => true,
  header = (section) => section.header?.cloneNode(true) as Node,
}: {
  section: T;
  deep?: (s: T) => boolean;
  header?: (section: T) => undefined | string | Node;
}) {
  const container = document.createElement("div");
  const id = `id-${String(Math.random()).split(".")[1]}-${Date.now()}`;
  container.setAttribute("id", id);
  if (!section) return container;

  const sectionView = renderSection(section);
  container.append(sectionView);
  const style = renderSectionStyles(id);
  container.append(style);
  return container;

  function renderSectionStyles(id?: string) {
    const prefix = id ? `#${id}` : "";
    const style = document.createElement("style");
    container.appendChild(style);
    style.innerHTML = `
      ${prefix} details {
          border: 1px solid #aaa;
          border-radius: 4px;
          padding: 0.5em 0.5em 0;
          margin-bottom: 0.5em;
        }
        
      ${prefix} details > summary {
          font-weight: bold;
          margin: -0.5em -0.5em 0;
          padding: 0.5em;
          cursor: pointer;
        }
        
      ${prefix} details[open] {
          padding: 0.5em;
        }
      `;
    return style;
  }
  function renderSection(section: T) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    details.appendChild(summary);
    const content = document.createElement("div");
    details.appendChild(content);
    const headerElm = header(section);
    headerElm && summary.append(headerElm);
    for (const node of section.content) {
      if (node.nodeName[0] === "#") continue;
      content.append(node.cloneNode(true));
    }
    if (deep(section)) {
      for (const child of section.children) {
        content.append(renderSection(child as T));
      }
    }
    return details;
  }
}
