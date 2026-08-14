import { newTreeBuilder } from "./newTreeBuilder.js";

export type DomSection = {
  header?: HTMLElement;
  content: Node[];
  children: DomSection[];
};

export function buildSections(root: HTMLElement | Iterable<Node>): DomSection {
  const nodes = toDomNodesIterator(root);
  let top: DomSection = null!;
  let peek: DomSection = null!;
  const stack: DomSection[] = [];
  const aligner = newTreeBuilder<[HTMLElement?]>({
    enter(_level, header) {
      const section: DomSection = {
        header,
        content: [],
        children: [],
      };
      top = top || section;
      peek?.children.push(section);
      peek = section;
      stack.push(section);
    },
    exit() {
      stack.pop();
      peek = stack[stack.length - 1];
    },
  });
  aligner(0);
  // Track the actual header magnitudes of the open ancestor sections. A header of
  // level L closes every open header at its level or deeper, then opens at the
  // resulting depth. Deriving depth from the real magnitudes (not a ±1 delta) keeps
  // nesting correct for any header sequence and never goes negative.
  const headerLevels: number[] = [];
  for (const node of nodes) {
    if (isDomElement(node)) {
      if (/^H[1-6]$/i.test(node.tagName)) {
        const headerLevel = +node.tagName.replace(/^H/, "");
        while (
          headerLevels.length > 0 &&
          headerLevels[headerLevels.length - 1] >= headerLevel
        ) {
          headerLevels.pop();
        }
        headerLevels.push(headerLevel);
        aligner(headerLevels.length, node);
      } else {
        peek.content.push(node);
      }
    } else {
      peek.content.push(node);
    }
  }
  return top.content.length === 0 && top.children.length === 1 && !top.header
    ? top.children[0]
    : top;
}

export function* visitSectionNodes(section: DomSection): Iterable<Node> {
  if (section.header) yield section.header;
  yield* section.content;
  for (const s of vistSections(section, true)) {
    yield* visitSectionNodes(s);
  }
}

export function* vistSections(
  root: DomSection,
  ignoreRoot: boolean = false,
): Generator<DomSection> {
  !ignoreRoot && (yield root);
  for (const child of root.children) {
    yield* vistSections(child, false);
  }
}

export function findSection(
  section: DomSection,
  accept: (section: DomSection) => boolean,
) {
  for (const s of vistSections(section)) {
    if (accept(s) === true) return s;
  }
  return undefined;
}

// --------------------------------------------
// DOM Iterator utilities

export function isDomElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE;
}

export function* toDomNodesIterator(
  root: Node | Iterable<Node>,
): Iterable<Node> {
  yield* root instanceof Node ? visitDom(root) : root;
}

export function* visitDom(elm: Node): Iterable<Node> {
  if (isDomElement(elm) && elm.tagName === "TEMPLATE") {
    elm = (elm as HTMLTemplateElement).content;
  }
  for (let node = elm.firstChild; node; node = node.nextSibling) {
    if (isDomElement(node)) {
      if (node.tagName === "DIV" || node.tagName === "TEMPLATE") {
        yield* visitDom(node);
      } else {
        yield node;
      }
    } else {
      yield node;
    }
  }
}
