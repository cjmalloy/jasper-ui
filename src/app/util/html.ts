export function getEl(node: Node) {
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
}
