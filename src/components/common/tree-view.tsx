import { Box, HStack, IconButton, VStack } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { LuChevronDown, LuChevronRight } from "react-icons/lu";

export interface TreeNode<T = unknown> {
  id: string;
  data: T;
  children?: TreeNode<T>[];
}

export interface StructTreeNodeData {
  key: string;
  value: unknown;
}

export interface TreeNodeRenderContext<T = unknown> {
  node: TreeNode<T>;
  depth: number;
  isLeaf: boolean;
  isExpanded: boolean;
}

interface TreeViewProps<T = unknown> {
  nodes: TreeNode<T>[];
  renderNode: (context: TreeNodeRenderContext<T>) => React.ReactNode;
  indentSize?: number;
  spacing?: number;
  defaultExpandedDepth?: number;
}

const collectExpandedIdsByDepth = <T,>(
  nodes: TreeNode<T>[],
  maxDepth: number,
  depth = 0,
  expandedIds = new Set<string>()
): Set<string> => {
  nodes.forEach((node) => {
    const children = node.children ?? [];
    if (children.length > 0 && depth < maxDepth) {
      expandedIds.add(node.id);
      collectExpandedIdsByDepth(children, maxDepth, depth + 1, expandedIds);
    }
  });
  return expandedIds;
};

export const collectLeafNodeIds = <T,>(node: TreeNode<T>): string[] => {
  const children = node.children ?? [];
  if (children.length === 0) {
    return [node.id];
  }
  return children.flatMap((child) => collectLeafNodeIds(child));
};

export const buildStructTreeNodes = (
  data: unknown,
  parentId = "root"
): TreeNode<StructTreeNodeData>[] => {
  if (typeof data !== "object" || data === null) {
    return [];
  }

  return Object.entries(data).map(([key, value]) => {
    const id = `${parentId}.${key}`;
    return {
      id,
      data: { key, value },
      children:
        typeof value === "object" && value !== null
          ? buildStructTreeNodes(value, id)
          : [],
    };
  });
};

const TreeView = <T,>({
  nodes,
  renderNode,
  indentSize = 3,
  spacing = 1,
  defaultExpandedDepth = 0,
}: TreeViewProps<T>) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedIds(collectExpandedIdsByDepth(nodes, defaultExpandedDepth));
  }, [nodes, defaultExpandedDepth]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const renderBranch = (node: TreeNode<T>, depth: number): React.ReactNode => {
    const children = node.children ?? [];
    const isLeaf = children.length === 0;
    const isExpanded = expandedIds.has(node.id);

    return (
      <VStack key={node.id} align="stretch" spacing={spacing}>
        <HStack
          spacing={1}
          w="100%"
          align="center"
          minH={6}
          pl={depth * indentSize}
        >
          {!isLeaf ? (
            <IconButton
              aria-label={isExpanded ? "collapse" : "expand"}
              icon={isExpanded ? <LuChevronDown /> : <LuChevronRight />}
              size="xs"
              variant="ghost"
              onClick={() => toggleExpanded(node.id)}
            />
          ) : (
            <Box w="24px" flexShrink={0} />
          )}
          <Box flex="1" minW={0}>
            {renderNode({ node, depth, isLeaf, isExpanded })}
          </Box>
        </HStack>
        {!isLeaf && isExpanded && (
          <VStack align="stretch" spacing={spacing}>
            {children.map((child) => renderBranch(child, depth + 1))}
          </VStack>
        )}
      </VStack>
    );
  };

  return (
    <VStack align="stretch" spacing={spacing} w="100%">
      {nodes.map((node) => renderBranch(node, 0))}
    </VStack>
  );
};

export default TreeView;
