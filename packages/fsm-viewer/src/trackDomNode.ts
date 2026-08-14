export function getInvalidation(node: Node): Promise<void> {
  const n = node as unknown as { invalidation: Promise<void> | undefined };
  return (n.invalidation =
    n.invalidation ||
    new Promise((resolve) => {
      trackDomNode(node, {
        onRemove: (node) => {
          resolve();
        },
      });
    }));
}

export function trackDomNode(
  node: Node,
  {
    onAdd = () => {},
    onRemove = () => {},
    isContainer = (n: Node) => n.nodeName === "MAIN" || n.nodeName === "BODY",
    getContainer = (node: Node) => {
      let container = node.ownerDocument?.body;
      for (let n = node.parentNode; !!n; n = n?.parentNode || null) {
        if (!isContainer(n)) continue;
        container = n as HTMLElement;
        break;
      }
      return container;
    },
  }: {
    onAdd?: (node: Node) => unknown;
    onRemove?: (node: Node, detach: boolean) => unknown;
    isContainer?: (n: Node) => boolean;
    getContainer?: (node: Node) => HTMLElement | undefined;
  },
) {
  requestAnimationFrame(() => {
    if (node.isConnected) {
      onAdd(node);
      const container = getContainer(node);
      if (container) {
        const observer = new MutationObserver(() => {
          if (node.isConnected) return;
          // if (container.contains(node)) return;
          observer.disconnect();
          onRemove(node, true);
        });
        observer.observe(container, { subtree: true, childList: true });
      } else {
        onRemove(node, true);
      }
    } else {
      onRemove(node, false);
    }
  });
  return node;
}
