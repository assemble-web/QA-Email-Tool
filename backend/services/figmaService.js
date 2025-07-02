import fetch from "node-fetch";

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;

export async function getFigmaTextNodes(fileId, nodeId = null) {
	const url = nodeId
		? `https://api.figma.com/v1/files/${fileId}/nodes?ids=${nodeId}`
		: `https://api.figma.com/v1/files/${fileId}`;

	const res = await fetch(url, {
		headers: { "X-Figma-Token": FIGMA_TOKEN },
	});
	if (!res.ok) throw new Error("No se pudo obtener datos de Figma");
	const data = await res.json();

	// Extraer nodos de texto
	const textNodes = [];
	const traverse = (node) => {
		if (!node) return;
		if (node.type === "TEXT") {
			textNodes.push({
				id: node.id,
				characters: node.characters,
				fontWeight: node.style?.fontWeight,
				fontFamily: node.style?.fontFamily,
				fontSize: node.style?.fontSize,
			});
		}
		if (node.children) node.children.forEach(traverse);
	};
	const document = nodeId ? data.nodes[nodeId].document : data.document;
	traverse(document);
	return textNodes;
}
