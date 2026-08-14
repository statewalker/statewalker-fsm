export function domToText(elm: HTMLElement) {
  const lines: string[] = [];
  visit(elm, (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(node.textContent || "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (
        node.nodeName === "BR" ||
        node.nodeName === "P" ||
        node.nodeName === "DIV"
      ) {
        lines.push("\n");
      }
    }
  });
  return lines.join("");

  function visit(el: HTMLElement, visitor: (node: Node) => void) {
    for (var i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      const result = visitor(el.childNodes[i]);
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      if (result !== undefined && !result) continue;
      visit(child as HTMLElement, visitor);
    }
  }
}
